/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import onboardingReducer from './slice/onboarding';
import { onboardingAPI } from './api/onboarding';

export default configureStore( {
	reducer: {
		onboarding: onboardingReducer,
		[ onboardingAPI.reducerPath ]: onboardingAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( onboardingAPI.middleware ),
} );
