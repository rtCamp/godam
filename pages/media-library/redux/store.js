/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import FolderReducer from './slice/folders';

export default configureStore( {
	reducer: { FolderReducer },
} );
