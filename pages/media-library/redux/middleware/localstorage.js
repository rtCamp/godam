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

		const localStorageData = JSON.parse( localStorage.getItem( 'easyDam' ) ) || {};
		let openItems = localStorageData.openItems || [];

		if ( folder.isOpen ) {
			if ( ! openItems.includes( folder.id ) ) {
				openItems.push( folder.id );
			}
		} else {
			openItems = openItems.filter( ( id ) => id !== folder.id );
		}

		localStorageData.openItems = openItems;
		localStorage.setItem( 'easyDam', JSON.stringify( localStorageData ) );
	},
} );

export default localStorageMiddleware;
