import { describe, expect, it } from 'vitest'
import { humanize } from './api.ts'

// Step S0: proves the unit test setup works on a pure function of the existing code.
describe('humanize', () => {
  it('splits camelCase and capitalises', () => {
    expect(humanize('firstName')).toBe('First Name')
  })
  it('replaces underscores and dashes', () => {
    expect(humanize('billing_address-city')).toBe('Billing address city')
  })
})
