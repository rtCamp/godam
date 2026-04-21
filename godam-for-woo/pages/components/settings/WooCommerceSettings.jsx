/**
 * WordPress dependencies
 */
import { Button, Notice, Spinner } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

const WooCommerceSettings = () => {
	const [ checking, setChecking ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	const handleCheckForUpdates = async () => {
		setChecking( true );
		setNotice( null );

		try {
			const response = await apiFetch( {
				path: '/godam/v1/godam-woo/check-update',
				method: 'POST',
			} );

			if ( response?.has_update ) {
				// Redirect to the plugins page where WP will show the update row.
				window.location.href = response.plugins_url;
				return;
			}

			setNotice( {
				status: 'info',
				message: __( 'No update found. You are running the latest version.', 'godam-woo' ),
			} );
		} catch ( error ) {
			setNotice( {
				status: 'error',
				message: error?.message || __( 'Failed to check for updates.', 'godam-woo' ),
			} );
		} finally {
			setChecking( false );
		}
	};

	const currentVersion = window?.godamWooSettings?.version || '';

	return (
		<>
			<div style={ { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' } }>
				<Button
					variant="secondary"
					onClick={ handleCheckForUpdates }
					disabled={ checking }
					isBusy={ checking }
				>
					{ checking
						? <>
							<Spinner />
							{ __( 'Checking…', 'godam-woo' ) }
						</>
						: __( 'Check for Updates', 'godam-woo' )
					}
				</Button>

				{ currentVersion && (
					<span className="description">
						{
							sprintf(
								/* translators: %s: Current version number. */
								__( 'Current version: %s', 'godam-woo' ),
								currentVersion
							)
						}
					</span>
				) }
			</div>

			{ notice && (
				<div style={ { marginTop: '12px' } }>
					<Notice
						status={ notice.status }
						isDismissible
						onRemove={ () => setNotice( null ) }
					>
						{ notice.message }
					</Notice>
				</div>
			) }
		</>
	);
};

export default WooCommerceSettings;
