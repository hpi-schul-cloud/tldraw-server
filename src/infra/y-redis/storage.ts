/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	By adhering to the license terms, we ensure that the use of the code from the `y-redis` repository is legally compliant.
*/
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Y from 'yjs';

export interface DocumentStorage {
	persistDoc(_room: string, _docname: string, _ydoc: Y.Doc): Promise<void>;

	retrieveDoc(_room: string, _docname: string): Promise<{ doc: Uint8Array; references: any[] } | null>;

	/**
	 * This can be implemented by the storage provider for better efficiency. The state vector must be
	 * updated when persistDoc is called. Otherwise, we pull the ydoc and compute the state vector.
	 */
	retrieveStateVector(room: string, docname: string): Promise<Uint8Array | null>;

	deleteReferences(_room: string, _docname: string, _storeReferences: any[]): Promise<void>;

	deleteDocument(room: string, docname: string): Promise<void>;

	destroy(): Promise<void>;
}