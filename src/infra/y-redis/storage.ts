/* eslint-disable @typescript-eslint/no-unused-vars */
import * as err from 'lib0/error';
import * as Y from 'yjs';

export class AbstractStorage {
	public persistDoc(_room: string, _docname: string, _ydoc: Y.Doc): Promise<void> {
		err.methodUnimplemented();
	}

	/**
	 * @param {string} _room
	 * @param {string} _docname
	 * @return {Promise<{ doc: Uint8Array, references: Array<any> }|null>}
	 */
	public retrieveDoc(_room: string, _docname: string): Promise<{ doc: Uint8Array; references: any[] } | null> {
		err.methodUnimplemented();
	}

	/**
	 * This can be implemented by the storage provider for better efficiency. The state vector must be
	 * updated when persistDoc is called. Otherwise, we pull the ydoc and compute the state vector.
	 *
	 * @param {string} room
	 * @param {string} docname
	 * @return {Promise<Uint8Array|null>}
	 */
	public async retrieveStateVector(room: string, docname: string): Promise<Uint8Array | null> {
		const r = await this.retrieveDoc(room, docname);

		return r ? Y.encodeStateVectorFromUpdateV2(r.doc) : null;
	}

	public deleteReferences(_room: string, _docname: string, _storeReferences: any[]): Promise<void> {
		err.methodUnimplemented();
	}

	/**
	 * @param {string} room
	 * @param {string} docname
	 * @return {Promise<void>}
	 */
	public deleteDocument(room: string, docname: string): Promise<void> {
		err.methodUnimplemented();
	}

	public destroy(): Promise<void> {
		err.methodUnimplemented();
	}
}
