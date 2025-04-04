/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';
/**
 * Internal dependencies
 */
import videoReducer from './slice/videoSlice';
import { videosAPI } from './api/video';
import { pollsAPI } from './api/polls';

export default configureStore( {
	reducer: {
		videoReducer,
		[ videosAPI.reducerPath ]: videosAPI.reducer,
		[ pollsAPI.reducerPath ]: pollsAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( videosAPI.middleware, pollsAPI.middleware ),
} );
