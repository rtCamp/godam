/**
 * WordPress dependencies
 */
import { useState, useEffect, useRef, createInterpolateElement } from '@wordpress/element';
import { Button, Dropdown } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import BackButton from '../BackButton';
import { useGetOrganizationApiKeyMutation, useListOrganizationsMutation } from '../../redux/api/onboarding';
import { selectOrganization, setConnected, setNotice, clearNotice, setOrganizations, reset } from '../../redux/slice/onboarding';
import { CheckIcon } from '../icons';
import { config, SUPPORT_URL } from '../../utils/constants';

const WorkspaceRow = ( { org } ) => (
	<span className="godam-onboarding__ws-row">
		<span className="godam-onboarding__ws-avatar" aria-hidden="true">{ ( org.organization_name || org.name || '?' ).charAt( 0 ).toUpperCase() }</span>
		<span className="godam-onboarding__ws-meta">
			<span className="godam-onboarding__ws-name">
				{ org.organization_name || org.name }
				{ org.plan && <span className="godam-onboarding__ws-badge">{ org.plan }</span> }
			</span>
			<span className="godam-onboarding__ws-role">{ org.role }</span>
		</span>
	</span>
);

/**
 * O6 — workspace selection. After a JWT login the user picks a workspace; we
 * fetch its API key (the durable credential) and connect. Each row shows
 * name + plan tier + role (plan tier pending a backend field).
 */
const WorkspaceScreen = () => {
	const dispatch = useDispatch();
	const organizations = useSelector( ( state ) => state.onboarding.organizations );
	const [ getOrganizationApiKey, { isLoading } ] = useGetOrganizationApiKeyMutation();
	const [ listOrganizations, { isLoading: isRefreshing } ] = useListOrganizationsMutation();
	// Nothing is chosen until the user picks one; the default follows the list so
	// it also fills in when a Refresh finds the account's first workspace.
	const [ chosen, setSelected ] = useState( null );
	const selected = chosen || organizations[ 0 ] || null;

	// Back unmounts this screen while a Refresh may still be in flight; its late
	// answer must not land on whatever screen the user went back to.
	const isMounted = useRef( false );
	useEffect( () => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, [] );

	// The JWT from sign-in is still held server-side, so re-fetching the list
	// needs no new sign-in. A found workspace re-renders this screen as the picker.
	const handleRefresh = async () => {
		try {
			const { organizations: latest = [] } = await listOrganizations().unwrap();
			if ( ! isMounted.current ) {
				return;
			}
			dispatch( setOrganizations( latest ) );
			if ( latest.length ) {
				dispatch( clearNotice() );
			} else {
				dispatch( setNotice( { status: 'info', message: __( 'Still no workspaces on this account. Create one in the GoDAM app, then refresh again.', 'godam' ) } ) );
			}
		} catch ( error ) {
			if ( isMounted.current ) {
				dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not load your workspaces. Please try again.', 'godam' ) } ) );
			}
		}
	};

	const handleContinue = async () => {
		if ( ! selected ) {
			return;
		}
		dispatch( selectOrganization( selected.name ) );
		try {
			await getOrganizationApiKey( selected.name ).unwrap();
			dispatch( setConnected() );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not get the workspace key.', 'godam' ) } ) );
		}
	};

	if ( ! organizations.length ) {
		// Workspace creation starts from picking a plan, so send the user to the
		// plans page (same path the upgrade flow uses), not the app root.
		const plansUrl = `${ config.appOrigin || 'https://app.godam.io' }/web/billing?tab=Plans`;
		return (
			<>
				<BackButton onClick={ () => dispatch( reset() ) } />
				<h1 className="godam-onboarding__title">{ __( 'No workspaces yet', 'godam' ) }</h1>
				<p className="godam-onboarding__subtitle">
					{ createInterpolateElement(
						__( 'This account has no workspaces. <a>Create one in the GoDAM app</a>, then come back here and select Refresh.', 'godam' ),
						{
							// eslint-disable-next-line jsx-a11y/anchor-has-content
							a: <a className="godam-onboarding__link" href={ plansUrl } target="_blank" rel="noreferrer" data-test-id="godam-onboarding-link-create-workspace" />,
						},
					) }
				</p>

				<div className="godam-onboarding__dialog-footer">
					<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleRefresh } disabled={ isRefreshing } isBusy={ isRefreshing } data-test-id="godam-onboarding-button-refresh">
						{ isRefreshing ? __( 'Checking…', 'godam' ) : __( 'Refresh', 'godam' ) }
					</Button>
				</div>

				<p className="godam-onboarding__alt">
					{ __( 'Need help?', 'godam' ) }{ ' ' }
					<a className="godam-onboarding__link" href={ SUPPORT_URL } target="_blank" rel="noreferrer" data-test-id="godam-onboarding-link-support">{ __( 'Contact support', 'godam' ) }</a>
				</p>
			</>
		);
	}

	return (
		<>
			<div className="godam-onboarding__dialog-head">
				<div>
					<h1 className="godam-onboarding__title">{ __( 'Select a workspace', 'godam' ) }</h1>
					<p className="godam-onboarding__subtitle">{ __( 'Choose a workspace to start working!', 'godam' ) }</p>
				</div>
				<button type="button" className="godam-onboarding__close" aria-label={ __( 'Close', 'godam' ) } onClick={ () => dispatch( reset() ) } data-test-id="godam-onboarding-button-close">✕</button>
			</div>

			<div className="godam-onboarding__form">
				<span className="components-base-control__label">{ __( 'Select a Workspace', 'godam' ) }</span>
				<Dropdown
					className="godam-onboarding__ws-dropdown"
					popoverProps={ { placement: 'bottom-start' } }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<button type="button" className="godam-onboarding__ws-select" aria-expanded={ isOpen } onClick={ onToggle } data-test-id="godam-onboarding-select-workspace">
							{ selected && <WorkspaceRow org={ selected } /> }
							<span className="godam-onboarding__ws-chevron" aria-hidden="true">▾</span>
						</button>
					) }
					renderContent={ ( { onClose } ) => (
						<ul className="godam-onboarding__ws-options">
							{ organizations.map( ( org ) => (
								<li key={ org.name }>
									<button type="button" className="godam-onboarding__ws-option" onClick={ () => {
										setSelected( org ); onClose();
									} }>
										<WorkspaceRow org={ org } />
										{ selected?.name === org.name && <span className="godam-onboarding__ws-check"><CheckIcon /></span> }
									</button>
								</li>
							) ) }
						</ul>
					) }
				/>
			</div>

			<div className="godam-onboarding__ws-note">
				<span aria-hidden="true">ⓘ</span>
				{ __( "Please note that you won't be able to switch to another workspace after logging in.", 'godam' ) }
			</div>

			<div className="godam-onboarding__dialog-footer">
				<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleContinue } disabled={ isLoading || ! selected } isBusy={ isLoading } data-test-id="godam-onboarding-button-workspace-continue">
					{ isLoading ? __( 'Connecting…', 'godam' ) : __( 'Continue', 'godam' ) }
				</Button>
			</div>
		</>
	);
};

export default WorkspaceScreen;
