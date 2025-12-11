import EmailsService from '@/api/services/Emails'
import { createDataStore } from './factory'

const EncryptedFields = ['email', 'password']

export const useEmailsStore = createDataStore(
  'emails',
  EmailsService,
  EncryptedFields
)

