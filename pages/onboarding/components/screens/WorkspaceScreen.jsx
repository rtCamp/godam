/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, RadioControl, Spinner, Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import { useGetOrganizationApiKeyMutation } from '../../redux/api/onboarding';
import { selectOrganization, setConnected, setNotice } from '../../redux/slice/onboarding';

/**
 * O6 — workspace selection. After a JWT login the user picks a workspace; we
 * fetch that org's API key (the durable credential) and connect.
 *
 * Per design review (Joel) each option shows name + plan tier + role. NOTE:
 * `list_my_organizations` returns `role` but not plan tier yet — we show role
 * now and render plan only when the backend adds it.
 */
const WorkspaceScreen = () => {
	const dispatch = useDispatch();
	const organizations = useSelector( ( state ) => state.onboarding.organizations );
	const [ getOrganizationApiKey, { isLoading } ] = useGetOrganizationApiKeyMutation();
	const [ selected, setSelected ] = useState( organizations[ 0 ]?.name || '' );

	const handleContinue = async () => {
		if ( ! selected ) {
			return;
		}
		dispatch( selectOrganization( selected ) );
		try {
			const res = await getOrganizationApiKey( selected ).unwrap();
			dispatch( setConnected( res.api_key ) );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not get the workspace key.', 'godam' ) } ) );
		}
	};

	if ( ! organizations.length ) {
		return (
			<div className="godam-onboarding__form">
				<h1 className="godam-onboarding__title">{ __( 'No workspaces yet', 'godam' ) }</h1>
				<p className="godam-onboarding__subtitle">{ __( 'This account has no workspaces. Create one in the GoDAM app, then come back.', 'godam' ) }</p>
			</div>
		);
	}

	const options = organizations.map( ( org ) => {
		const label = org.plan
			? sprintf( /* translators: 1: workspace name, 2: plan tier, 3: role. */ __( '%1$s — %2$s (You are a %3$s)', 'godam' ), org.organization_name || org.name, org.plan, org.role )
			: sprintf( /* translators: 1: workspace name, 2: role. */ __( '%1$s (You are a %2$s)', 'godam' ), org.organization_name || org.name, org.role );
		return { label, value: org.name };
	} );

	return (
		<div className="godam-onboarding__form">
			<h1 className="godam-onboarding__title">{ __( 'Select a workspace', 'godam' ) }</h1>
			<p className="godam-onboarding__subtitle">{ __( 'Your account is attached to multiple workspaces. Choose one to start working.', 'godam' ) }</p>

			<RadioControl selected={ selected } options={ options } onChange={ setSelected } data-test-id="godam-onboarding-radio-workspace" />

			<Notice status="warning" isDismissible={ false } className="godam-onboarding__notice">
				{ __( "Please note you won't be able to switch to another workspace after logging in.", 'godam' ) }
			</Notice>

			<Button variant="primary" className="godam-onboarding__cta" onClick={ handleContinue } disabled={ isLoading || ! selected } isBusy={ isLoading } icon={ isLoading && <Spinner /> } data-test-id="godam-onboarding-button-workspace-continue">
				{ isLoading ? __( 'Connecting…', 'godam' ) : __( 'Continue', 'godam' ) }
			</Button>
		</div>
	);
};

export default WorkspaceScreen;
