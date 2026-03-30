import React from 'react'
import { render, screen } from '@testing-library/react'
import { setupServer } from 'msw/node'

import App from './App'
import i18n from './i18n/config'
import { handlers } from './mocks/handlers'

jest.mock('./auth', () => ({
  ...jest.requireActual('./auth'),
  loadAccessToken: jest.fn(),
  exchangeCodeForToken: jest.fn()
}))

const auth = jest.requireMock('./auth')
const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  i18n.changeLanguage('en')
  server.resetHandlers()
  localStorage.clear()
  jest.clearAllMocks()
})

test('renders login when no access token exists', async () => {
  auth.loadAccessToken.mockReturnValue(null)

  render(<App />)

  expect(await screen.findByText(/get started/i)).toBeInTheDocument()
})

test('renders playlist workflow when an access token exists', async () => {
  auth.loadAccessToken.mockReturnValue('TEST_ACCESS_TOKEN')

  render(<App />)

  expect(await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')).toBeInTheDocument()
})
