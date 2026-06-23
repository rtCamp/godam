/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { STEPS, config } from '../../utils/constants';

const initialState = {
	step: STEPS.ENTRY,
	email: '',
	// Transient session minted by login/google; the durable credential is the
	// org API key fetched after workspace selection (stored server-side by PHP).
	jwt: null,
	authMethod: null,
	user: null,
	organizations: [],
	selectedOrganization: null,
	apiKey: null,
	notice: null, // { message, status }
};

const onboardingSlice = createSlice( {
	name: 'onboarding',
	initialState,
	reducers: {
		goToStep( state, action ) {
			state.step = action.payload;
			state.notice = null;
		},
		setEmail( state, action ) {
			state.email = action.payload;
		},
		setSession( state, action ) {
			state.jwt = action.payload.token;
			state.authMethod = action.payload.auth_method;
			state.user = action.payload.user;
		},
		setOrganizations( state, action ) {
			state.organizations = action.payload;
		},
		selectOrganization( state, action ) {
			state.selectedOrganization = action.payload;
		},
		setConnected( state, action ) {
			state.apiKey = action.payload;
			state.step = STEPS.WELCOME;
		},
		setNotice( state, action ) {
			state.notice = action.payload;
		},
		clearNotice( state ) {
			state.notice = null;
		},
		reset() {
			return { ...initialState, email: config.lastEmail || '' };
		},
	},
} );

export const {
	goToStep,
	setEmail,
	setSession,
	setOrganizations,
	selectOrganization,
	setConnected,
	setNotice,
	clearNotice,
	reset,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
