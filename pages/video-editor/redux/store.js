/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';
/**
 * Internal dependencies
 */
import videoReducer from './slice/videoSlice';

export default configureStore( {
	reducer: { videoReducer },
} );
