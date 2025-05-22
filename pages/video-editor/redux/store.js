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
import { contactForm7Api } from './api/cf7-forms';
import { wpFormsApi } from './api/wpforms';

export default configureStore( {
	reducer: {
		videoReducer,
		[ videosAPI.reducerPath ]: videosAPI.reducer,
		[ pollsAPI.reducerPath ]: pollsAPI.reducer,
		[ attachmentAPI.reducerPath ]: attachmentAPI.reducer,
		[ gravityFormsAPI.reducerPath ]: gravityFormsAPI.reducer,
		[ contactForm7Api.reducerPath ]: contactForm7Api.reducer,
		[ wpFormsApi.reducerPath ]: wpFormsApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat(
		videosAPI.middleware,
		pollsAPI.middleware,
		attachmentAPI.middleware,
		gravityFormsAPI.middleware,
		contactForm7Api.middleware,
		wpFormsApi.middleware,
	),
} );
