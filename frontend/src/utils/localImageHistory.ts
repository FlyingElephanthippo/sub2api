export const LOCAL_IMAGE_HISTORY_LIMIT = 100

export interface LocalImageHistoryInput {
  id: string
  blob: Blob
  prompt: string
  timestamp: number
  size: string
  format: string
  mimeType: string
  extension: string
  model: string
  provider: string
  normalizedParams: unknown
  referenceSnapshot?: unknown
}

export interface LocalImageHistoryRecord extends LocalImageHistoryInput {
  userID: number
}

const DATABASE_NAME = 'sub2api-local-image-history'
const STORE_NAME = 'images'
const USER_INDEX = 'userID'

function validateUser(userID: number): void {
  if (!Number.isSafeInteger(userID) || userID <= 0) {
    throw new Error('A signed-in user is required for local image history.')
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false
    try {
      if (!globalThis.indexedDB) {
        reject(new Error('Local image history is unavailable in this browser.'))
        return
      }
      const request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: ['userID', 'id'] })
        store.createIndex(USER_INDEX, 'userID')
      }
      request.onerror = () => {
        settled = true
        reject(request.error || new Error('Could not open local image history.'))
      }
      request.onblocked = () => {
        settled = true
        reject(new Error('Local image history is blocked by another open page.'))
      }
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        if (settled) {
          database.close()
          return
        }
        settled = true
        resolve(database)
      }
    } catch (error) {
      reject(error)
    }
  })
}

async function transact<T>(
  mode: IDBTransactionMode,
  initialResult: T,
  operation: (store: IDBObjectStore, setResult: (result: T) => void) => void,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction | undefined
    let result = initialResult
    try {
      transaction = database.transaction(STORE_NAME, mode)
      transaction.oncomplete = () => {
        database.close()
        resolve(result)
      }
      transaction.onabort = () => {
        database.close()
        reject(transaction?.error || new DOMException('Local image history was not saved.', 'AbortError'))
      }
      operation(transaction.objectStore(STORE_NAME), value => { result = value })
    } catch (error) {
      transaction?.abort()
      database.close()
      reject(error)
    }
  })
}

function newestFirst(left: LocalImageHistoryRecord, right: LocalImageHistoryRecord): number {
  return right.timestamp - left.timestamp || left.id.localeCompare(right.id)
}

/** Persist only image bytes and display metadata; never the request, API key or object URL. */
export async function saveLocalImage(userID: number, image: LocalImageHistoryInput): Promise<void> {
  validateUser(userID)
  if (!image.id || !Number.isFinite(image.timestamp)) {
    throw new Error('Local image history requires an image ID and timestamp.')
  }
  const record: LocalImageHistoryRecord = {
    userID,
    id: image.id,
    blob: image.blob,
    prompt: image.prompt,
    timestamp: image.timestamp,
    size: image.size,
    format: image.format,
    mimeType: image.mimeType,
    extension: image.extension,
    model: image.model,
    provider: image.provider,
    normalizedParams: image.normalizedParams,
    referenceSnapshot: image.referenceSnapshot,
  }
  await transact('readwrite', undefined, store => {
    store.put(record)
    const request = store.index(USER_INDEX).getAll(userID)
    request.onsuccess = () => {
      const images = request.result as LocalImageHistoryRecord[]
      for (const expired of images.sort(newestFirst).slice(LOCAL_IMAGE_HISTORY_LIMIT)) {
        store.delete([userID, expired.id])
      }
    }
  })
}

export async function listLocalImages(userID: number): Promise<LocalImageHistoryRecord[]> {
  validateUser(userID)
  return transact<LocalImageHistoryRecord[]>('readonly', [], (store, setResult) => {
    const request = store.index(USER_INDEX).getAll(userID)
    request.onsuccess = () => setResult((request.result as LocalImageHistoryRecord[]).sort(newestFirst))
  })
}

export async function deleteLocalImage(userID: number, id: string): Promise<void> {
  validateUser(userID)
  await transact('readwrite', undefined, store => { store.delete([userID, id]) })
}
