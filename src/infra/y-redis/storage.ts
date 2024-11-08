import * as Y from 'yjs';

export interface DocumentStorage {
	persistDoc(_room: string, _docname: string, _ydoc: Y.Doc): Promise<void>;

	retrieveDoc(_room: string, _docname: string): Promise<{ doc: Uint8Array; references: string[] } | null>;

	/**
	 * This can be implemented by the storage provider for better efficiency. The state vector must be
	 * updated when persistDoc is called. Otherwise, we pull the ydoc and compute the state vector.
	 */
	retrieveStateVector(room: string, docname: string): Promise<Uint8Array | null>;

	deleteReferences(_room: string, _docname: string, _storeReferences: string[]): Promise<void>;

	deleteDocument(room: string, docname: string): Promise<void>;

	destroy(): Promise<void>;
}
