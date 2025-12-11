import ServersService from '@/api/services/Servers'
import { createDataStore } from './factory'

const EncryptedFields = ['ip', 'username', 'password', 'hosting_username', 'hosting_password', 'admin_username', 'admin_password', 'extra']

export const useServersStore = createDataStore(
  'servers',
  ServersService,
  EncryptedFields
)

