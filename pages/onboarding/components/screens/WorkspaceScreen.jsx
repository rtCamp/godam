/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, Dropdown } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import { useGetOrganizationApiKeyMutation } from '../../redux/api/onboarding';
import { selectOrganization, setConnected, setNotice, reset } from '../../redux/slice/onboarding';
import { CheckIcon } from '../icons';

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
	const [ selected, setSelected ] = useState( organizations[ 0 ] || null );

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
		return (
			<>
				<h1 className="godam-onboarding__title">{ __( 'No workspaces yet', 'godam' ) }</h1>
				<p className="godam-onboarding__subtitle">{ __( 'This account has no workspaces. Create one in the GoDAM app, then come back.', 'godam' ) }</p>
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
