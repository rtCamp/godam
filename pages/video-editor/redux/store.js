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
import { jetpackFormsApi } from './api/jetpack-forms';
import { sureformsApi } from './api/sureforms';
import { forminatorFormsApi } from './api/forminator-forms';
import { fluentFormsApi } from './api/fluent-forms';
import { everestFormsApi } from './api/everest-forms';
import { ninjaFormsApi } from './api/ninja-forms';
import { metformApi } from './api/metform';
import { globalSettingsAPI } from './api/global-settings';

export default configureStore( {
	reducer: {
		videoReducer,
		[ videosAPI.reducerPath ]: videosAPI.reducer,
		[ pollsAPI.reducerPath ]: pollsAPI.reducer,
		[ attachmentAPI.reducerPath ]: attachmentAPI.reducer,
		[ gravityFormsAPI.reducerPath ]: gravityFormsAPI.reducer,
		[ contactForm7Api.reducerPath ]: contactForm7Api.reducer,
		[ wpFormsApi.reducerPath ]: wpFormsApi.reducer,
		[ jetpackFormsApi.reducerPath ]: jetpackFormsApi.reducer,
		[ sureformsApi.reducerPath ]: sureformsApi.reducer,
		[ forminatorFormsApi.reducerPath ]: forminatorFormsApi.reducer,
		[ fluentFormsApi.reducerPath ]: fluentFormsApi.reducer,
		[ everestFormsApi.reducerPath ]: everestFormsApi.reducer,
		[ ninjaFormsApi.reducerPath ]: ninjaFormsApi.reducer,
		[ metformApi.reducerPath ]: metformApi.reducer,
		[ globalSettingsAPI.reducerPath ]: globalSettingsAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat(
		videosAPI.middleware,
		pollsAPI.middleware,
		attachmentAPI.middleware,
		gravityFormsAPI.middleware,
		contactForm7Api.middleware,
		wpFormsApi.middleware,
		jetpackFormsApi.middleware,
		sureformsApi.middleware,
		forminatorFormsApi.middleware,
		fluentFormsApi.middleware,
		everestFormsApi.middleware,
		ninjaFormsApi.middleware,
		metformApi.middleware,
		globalSettingsAPI.middleware,
	),
} );
