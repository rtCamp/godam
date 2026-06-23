/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { STEPS } from '../../utils/constants';

// The GoDAM JWT and the durable org API key both live server-side (held/stored
// by the WP proxy); the SPA only tracks UI state + the resolved user/workspaces.
const initialState = {
	step: STEPS.ENTRY,
	email: '',
	user: null,
	organizations: [],
	selectedOrganization: null,
	connected: false,
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
			state.user = action.payload.user;
		},
		setOrganizations( state, action ) {
			state.organizations = action.payload;
		},
		selectOrganization( state, action ) {
			state.selectedOrganization = action.payload;
		},
		setConnected( state ) {
			// The durable org API key is stored server-side by the proxy; the
			// SPA only needs to advance to the welcome screen.
			state.connected = true;
			state.step = STEPS.WELCOME;
		},
		setNotice( state, action ) {
			state.notice = action.payload;
		},
		clearNotice( state ) {
			state.notice = null;
		},
		reset() {
			return { ...initialState };
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
