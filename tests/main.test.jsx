import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ render: vi.fn(), initialize: vi.fn() }))
vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: mocks.render }),
}))
vi.mock('../src/auth.js', () => ({ initializeAuth: mocks.initialize }))
vi.mock('../src/App.jsx', () => ({ default: () => null }))
afterEach(() => {
  vi.resetModules()
  mocks.render.mockClear()
})
it.each([true, false])(
  'inicia a aplicação mesmo se o login estiver indisponível: %s',
  async (available) => {
    if (available) mocks.initialize.mockResolvedValue({ available: true })
    else mocks.initialize.mockRejectedValue(new Error('offline'))
    await import('../src/main.jsx')
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce())
    expect(
      mocks.render.mock.calls[0][0].props.children.props.auth.available,
    ).toBe(available)
  },
)
