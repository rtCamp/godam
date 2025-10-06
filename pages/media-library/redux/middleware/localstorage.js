/**
 * External dependencies
 */
import { createListenerMiddleware } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { toggleOpenClose } from '../slice/folders';
import { checkIfListSelected } from '../../data/media-grid';

/**
 * Middleware to save the selected folder and open folders in local storage
 *
 * It does not modify the state, it just listens to actions and saves the data in local storage.
 * We can not update the data from local storage to be used here, because it does not allow action.payload modification.
 */
const localStorageMiddleware = createListenerMiddleware();

localStorageMiddleware.startListening( {
	actionCreator: toggleOpenClose,
	effect: ( action, listenerApi ) => {
		if ( ! checkIfListSelected() ) {
			return;
		}

		const state = listenerApi.getState();

		const folder = state.FolderReducer.folders.find( ( item ) => item.id === action.payload.id );

		if ( ! folder ) {
			return; // If the folder is not found, eat five star
		}

		const oldStorageItemKey = 'easyDam'; // for backward compatibility
		const localStorageItemKey = 'goDam';

		// Check for existing data in new localStorage key (goDam).
		// If not found, fall back to old key (easyDam) for backward compatibility.
		// This ensures older saved data is still accessible after the key rename.
		const goDamLocalStorageData = localStorage.getItem( localStorageItemKey ) || localStorage.getItem( oldStorageItemKey )
		const localStorageData = JSON.parse( goDamLocalStorageData ) || {};
		let openItems = localStorageData.openItems || [];

		if ( folder.isOpen ) {
			if ( ! openItems.includes( folder.id ) ) {
				openItems.push( folder.id );
			}
		} else {
			openItems = openItems.filter( ( id ) => id !== folder.id );
		}

		localStorageData.openItems = openItems;
		localStorage.setItem( localStorageItemKey, JSON.stringify( localStorageData ) );

		// If old localStorage key (easyDam) still exists, remove it.
		// This cleanup prevents duplicate storage and ensures we only use the new key (goDam).
		if ( localStorage.getItem( oldStorageItemKey ) ) {
			localStorage.removeItem( oldStorageItemKey );
		}
	},
} );

export default localStorageMiddleware;
