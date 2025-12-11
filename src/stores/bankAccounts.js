import BankAccountsService from '@/api/services/BankAccounts'
import { createDataStore } from './factory'

const EncryptedFields = ['account_name', 'account_number', 'iban', 'currency', 'password']

export const useBankAccountsStore = createDataStore(
  'bankAccounts',
  BankAccountsService,
  EncryptedFields
)

