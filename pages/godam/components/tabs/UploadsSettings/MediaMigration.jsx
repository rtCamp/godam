/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getMediaMigrationProgress } from '../../../utils';
import { __, _x } from '@wordpress/i18n';
import { Button, Panel, PanelBody } from '@wordpress/components';

const MediaMigration = () => {
	const [ migrationStarted, setMigrationStarted ] = useState( null );
	const [ migrationStopped, setMigrationStopped ] = useState( null );
	const [ requestingProgress, setRequestingProgress ] = useState( false );
	const [ mediaMigrationProgress, setMediaMigrationProgress ] = useState( getMediaMigrationProgress );

	/**
	 * Function to set the migration state based on the action.
	 *
	 * @param {string}  action - The action to perform, e.g., 'start', 'stop', 'progress'.
	 * @param {boolean} value  - The value to set for the migration state.
	 */
	const setMigrationState = useCallback( ( action, value ) => {
		switch ( action ) {
			case 'start':
				setMigrationStarted( value );
				break;
			case 'stop':
				setMigrationStopped( value );
				break;
			case 'progress':
				setRequestingProgress( value );
				break;
		}
	}, [] );

	/**
	 * Function to handle media migration actions.
	 *
	 * @param {string} subAction - The action to perform, e.g., 'start', 'stop', 'progress'.
	 *
	 * @return {Promise<void>}
	 */
	const mediaMigration = useCallback( async ( subAction ) => {
		// Check if the migration is already running.
		setMigrationState( subAction, true );

		try {
			const response = await fetch( window?.goDAMUploadsData?.ajax_url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( {
					action: 'godam_handle_files_migration',
					nonce: window?.goDAMUploadsData?.nonce,
					subAction,
				} ),
			} );

			const result = await response.json();
			if ( result.success ) {
				// Update the media migration progress state
				if ( 'progress' === subAction ) {
					setMediaMigrationProgress( result.data );
				}

				// Update requesting state.
				setMigrationState( subAction, false );
			} else {
				// Update requesting state.
				setMigrationState( subAction, false );
			}
		} catch ( error ) {
			// Update requesting state.
			setMigrationState( subAction, false );
		}
	}, [ setMigrationState ] );

	/**
	 * Button component to run the media migration.
	 *
	 * @class
	 */
	const RunMigrationButton = () => {
		if ( 'running' === mediaMigrationProgress.status ) {
			return;
		}

		return (
			<Button
				variant="secondary"
				className="godam-button godam-migrate-media-button"
				onClick={ () => mediaMigration( 'start' ) }
				isBusy={ migrationStarted }
				disabled={ mediaMigrationProgress.remaining === 0 }
			>
				{ __( 'Run Migration', 'godam' ) }
			</Button>
		);
	};

	/**
	 * Button component to stop the media migration.
	 *
	 * @class
	 */
	const StopMigrationButton = () => {
		if ( 'running' !== mediaMigrationProgress.status ) {
			return;
		}

		return (
			<Button
				variant="secondary"
				className="godam-button godam-migrate-media-button"
				onClick={ () => mediaMigration( 'stop' ) }
				isBusy={ migrationStopped }
			>
				{ __( 'Stop Migration', 'godam' ) }
			</Button>
		);
	};

	// Set an interval to fetch the media migration progress every 5 seconds.
	useEffect( () => {
		const interval = setInterval( () => {
			if ( ! requestingProgress ) {
				mediaMigration( 'progress' );
			}
		}, 3000 );

		return () => clearInterval( interval );
	}, [ mediaMigration, requestingProgress ] );

	// Fetch the initial media migration progress when the component mounts.
	if ( ! mediaMigrationProgress ) {
		return null;
	}

	return (
		<>
			<Panel header={ __( 'Migrate Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<div className="flex gap-3 items-center mb-4">
						<div>
							<p className="text-sm mb-3 mt-0">
								{ __( 'Migrate existing media to godam to prevent broken media links on the frontend.', 'godam' ) }
							</p>
							<span className="mr-2"><strong>{ __( 'Status: ', 'godam' ) }</strong>{ 0 === mediaMigrationProgress.remaining ? __( 'completed', 'godam' ) : mediaMigrationProgress.status }</span>
							<span className="mr-2"><strong>{ __( 'Remaining: ', 'godam' ) }</strong>{ mediaMigrationProgress.remaining } { _x( 'Files', 'files', 'godam' ) }</span>
							<span><strong>{ __( 'Failed: ', 'godam' ) }</strong>{ mediaMigrationProgress.failed } { _x( 'Files', 'files', 'godam' ) }</span>
						</div>
					</div>
					<RunMigrationButton />
					<StopMigrationButton />
				</PanelBody>
			</Panel>
		</>
	);
};

export default MediaMigration;
