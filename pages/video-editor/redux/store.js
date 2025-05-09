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
import { attachmentAPI } from './api/attachment';
import { gravityFormsAPI } from './api/gravity-forms';

export default configureStore( {
	reducer: {
		videoReducer,
		[ videosAPI.reducerPath ]: videosAPI.reducer,
		[ pollsAPI.reducerPath ]: pollsAPI.reducer,
		[ attachmentAPI.reducerPath ]: attachmentAPI.reducer,
		[ gravityFormsAPI.reducerPath ]: gravityFormsAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat(
		videosAPI.middleware,
		pollsAPI.middleware,
		attachmentAPI.middleware,
		gravityFormsAPI.middleware,
	),
} );
