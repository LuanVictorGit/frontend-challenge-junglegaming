// HTTP/socket traffic waits for the mock backend (when enabled) without blocking the first paint.
export const mocksEnabled = import.meta.env.VITE_MOCKS !== 'false'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.test'

let resolve: () => void = () => {}
export const backendReady: Promise<void> = mocksEnabled ? new Promise((r) => (resolve = r)) : Promise.resolve()
export const markBackendReady = () => resolve()
