import CreditCardsService from '@/api/services/CreditCards'
import { createDataStore } from './factory'

const EncryptedFields = ['type', 'number', 'expiry_date', 'cardholder_name', 'verification_number']

export const useCreditCardsStore = createDataStore(
  'creditCards',
  CreditCardsService,
  EncryptedFields
)

