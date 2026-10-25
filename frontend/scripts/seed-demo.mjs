// Demo data for manual testing: accounts, contacts, deals and tasks through the public API.
//   npm run seed                                  (API on http://localhost:5080)
//   API_URL=http://localhost:5173 npm run seed    (through the front end proxy)
const API = process.env.API_URL || 'http://localhost:5080'
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || 'admin-dev-password-1' }
const COUNT = Number(process.env.COUNT || 60)

const login = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) })
if (!login.ok) throw new Error(`login failed: ${login.status}`)
const token = (await login.json()).accessToken

async function post(entity, body) {
  const response = await fetch(`${API}/v1/records/${entity}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`${entity}: ${response.status} ${await response.text()}`)
  return response.json()
}

const industries = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Other']
const cities = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Liberec']
const first = ['Jan', 'Petr', 'Eva', 'Jana', 'Martin', 'Lucie', 'Tomáš', 'Kateřina']
const last = ['Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházková', 'Kučera', 'Veselý', 'Horáková']
const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost']

let created = 0
for (let i = 1; i <= COUNT; i++) {
  const account = await post('account', {
    name: `Demo firma ${String(i).padStart(3, '0')}`, industry: industries[i % industries.length], website: `https://firma${i}.example.com`,
    revenue: String(10000 * i) + '.00', email: `info@firma${i}.example.com`, billingCity: cities[i % cities.length], type: ['customer', 'prospect', 'partner', 'other'][i % 4],
  })
  const contact = await post('contact', { firstName: first[i % first.length], lastName: `${last[i % last.length]} ${i}`, email: `kontakt${i}@firma${i}.example.com`, accountId: account.id })
  if (i % 3 === 0) {
    const deal = await post('deal', { name: `Obchod ${i}`, amount: `${5000 * i}.00`, stage: stages[i % stages.length], accountId: account.id, contactId: contact.id })
    await post('task', { subject: `Zavolat ${contact.lastName}`, dealId: deal.id, accountId: account.id })
    created++
  }
  created++
}
console.log(`created ${COUNT} accounts, ${COUNT} contacts and ${created - COUNT} deals/tasks at ${API}`)
