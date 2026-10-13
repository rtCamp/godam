/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useListOrganizationsMutation } from '../redux/api/onboarding';
import { setSession, setOrganizations, setNotice, goToStep } from '../redux/slice/onboarding';
import { STEPS } from './constants';

/**
 * Shared "post-login" step: once a JWT session is obtained (password or
 * Google), fetch the user's workspaces and advance to the workspace picker.
 *
 * @return {(session:Object)=>Promise<void>} Handler that takes the login payload.
 */
export const useProceedToWorkspace = () => {
	const dispatch = useDispatch();
	const [ listOrganizations ] = useListOrganizationsMutation();

	return async ( session ) => {
		dispatch( setSession( session ) );
		try {
			const { organizations = [] } = await listOrganizations().unwrap();
			dispatch( setOrganizations( organizations ) );
			dispatch( goToStep( STEPS.WORKSPACE ) );
		} catch ( error ) {
			dispatch( setNotice( {
				status: 'error',
				message: error?.data?.message || __( 'Could not load your workspaces. Please try again.', 'godam' ),
			} ) );
		}
	};
};
