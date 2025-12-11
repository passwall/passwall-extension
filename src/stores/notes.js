import NotesService from '@/api/services/Notes'
import { createDataStore } from './factory'

const EncryptedFields = ['note']

export const useNotesStore = createDataStore(
  'notes',
  NotesService,
  EncryptedFields
)

