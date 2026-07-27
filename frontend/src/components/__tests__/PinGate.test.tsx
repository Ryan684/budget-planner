import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinGate } from '../PinGate'

vi.mock('../../api/auth', () => ({
  pinRequired: vi.fn(),
  verifyPin: vi.fn(),
}))

import { pinRequired, verifyPin } from '../../api/auth'

const mockPinRequired = vi.mocked(pinRequired)
const mockVerifyPin = vi.mocked(verifyPin)

const SECRET = 'Monthly surplus'

function renderGate() {
  return render(
    <PinGate>
      <p>{SECRET}</p>
    </PinGate>,
  )
}

async function enterPin(pin: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/pin/i), pin)
  await user.click(screen.getByRole('button', { name: /unlock/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('PinGate', () => {
  it('renders the lock screen and hides the app when a PIN is required', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    renderGate()

    expect(await screen.findByLabelText(/pin/i)).toBeInTheDocument()
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
  })

  it('renders the app straight through when no PIN is configured', async () => {
    mockPinRequired.mockResolvedValue({ required: false })
    renderGate()

    expect(await screen.findByText(SECRET)).toBeInTheDocument()
    expect(screen.queryByLabelText(/pin/i)).not.toBeInTheDocument()
    expect(mockVerifyPin).not.toHaveBeenCalled()
  })

  it('unlocks on the correct PIN', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    mockVerifyPin.mockResolvedValue({ ok: true })
    renderGate()
    await screen.findByLabelText(/pin/i)

    await enterPin('1234')

    expect(await screen.findByText(SECRET)).toBeInTheDocument()
    expect(mockVerifyPin).toHaveBeenCalledWith('1234')
  })

  it('shows an error and stays locked on an incorrect PIN', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    mockVerifyPin.mockResolvedValue({ ok: false })
    renderGate()
    await screen.findByLabelText(/pin/i)

    await enterPin('9999')

    expect(await screen.findByText(/incorrect pin/i)).toBeInTheDocument()
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/pin/i)).toBeInTheDocument()
  })

  it('persists the unlock for the browser session', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    mockVerifyPin.mockResolvedValue({ ok: true })
    const first = renderGate()
    await screen.findByLabelText(/pin/i)
    await enterPin('1234')
    await screen.findByText(SECRET)
    first.unmount()

    // A reload within the same session: sessionStorage still carries the unlock.
    renderGate()
    expect(await screen.findByText(SECRET)).toBeInTheDocument()
    expect(mockVerifyPin).toHaveBeenCalledTimes(1)
  })

  it('re-locks when the browser session ends', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    mockVerifyPin.mockResolvedValue({ ok: true })
    const first = renderGate()
    await screen.findByLabelText(/pin/i)
    await enterPin('1234')
    await screen.findByText(SECRET)
    first.unmount()

    sessionStorage.clear() // a new browser session
    renderGate()

    expect(await screen.findByLabelText(/pin/i)).toBeInTheDocument()
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
  })

  it('shows a retryable error and reveals nothing when the gate check fails', async () => {
    mockPinRequired.mockRejectedValue(new Error('Failed to fetch'))
    renderGate()

    const retry = await screen.findByRole('button', { name: /try again/i })
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()

    mockPinRequired.mockResolvedValue({ required: true })
    await userEvent.setup().click(retry)

    expect(await screen.findByLabelText(/pin/i)).toBeInTheDocument()
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
  })

  it('shows a retryable error and stays locked when verification fails', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    mockVerifyPin.mockRejectedValue(new Error('Failed to fetch'))
    renderGate()
    await screen.findByLabelText(/pin/i)

    await enterPin('1234')

    expect(await screen.findByText(/could not reach/i)).toBeInTheDocument()
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
    // the form stays usable so the user can retry without a reload
    expect(screen.getByRole('button', { name: /unlock/i })).toBeEnabled()
  })
})

describe('PinGate while the gate check is in flight', () => {
  it('shows a loading state rather than the lock screen or the app', async () => {
    let release: (v: { required: boolean }) => void = () => {}
    mockPinRequired.mockReturnValue(new Promise(resolve => { release = resolve }))
    renderGate()

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/pin/i)).not.toBeInTheDocument()
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()

    release({ required: true })
    expect(await screen.findByLabelText(/pin/i)).toBeInTheDocument()
  })

  it('disables the unlock button while a PIN is being checked', async () => {
    mockPinRequired.mockResolvedValue({ required: true })
    let release: (v: { ok: boolean }) => void = () => {}
    mockVerifyPin.mockReturnValue(new Promise(resolve => { release = resolve }))
    renderGate()
    await screen.findByLabelText(/pin/i)

    await enterPin('1234')

    expect(screen.getByRole('button', { name: /checking/i })).toBeDisabled()
    release({ ok: true })
    expect(await screen.findByText(SECRET)).toBeInTheDocument()
  })
})
