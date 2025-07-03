/**
 * External dependencies
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	Panel,
	PanelBody,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import ProgressBar from '../../Progressbar';
import { useEffect, useRef } from '@wordpress/element';

const CoreVideoMigration = ( { migrationStatus, setMigrationStatus } ) => {
	const intervalRef = useRef( null );

	const handleMigrationClick = async () => {
		const url = window.godamRestRoute?.url + 'godam/v1/vimeo-migrate';

		axios.post( url )
			.then( ( response ) => {
				setMigrationStatus( response.data );
			} )
			.catch( ( error ) => {
				alert( __( 'An error occurred during migration: ', 'godam' ) + error.message );
			} );
	};

	const fetchMigrationStatus = async () => {
		const url = window.godamRestRoute?.url + 'godam/v1/vimeo-migration/status';

		try {
			const response = await axios.get( url );
			setMigrationStatus( response.data );
		} catch ( error ) {
			console.error( 'Error fetching migration status:', error );
		}
	};

	// Start polling when migration is processing
	useEffect( () => {
		if ( migrationStatus?.status === 'processing' ) {
			// Clear any existing interval
			if ( intervalRef.current ) {
				clearInterval( intervalRef.current );
			}

			// Start polling every 5 seconds
			intervalRef.current = setInterval( fetchMigrationStatus, 5000 );
		}

		// Stop polling when migration is not processing
		if ( migrationStatus?.status !== 'processing' && intervalRef.current ) {
			clearInterval( intervalRef.current );
			intervalRef.current = null;
		}

		// Cleanup interval on component unmount
		return () => {
			if ( intervalRef.current ) {
				clearInterval( intervalRef.current );
			}
		};
	}, [ migrationStatus?.status ] );

	if ( ! migrationStatus ) {
		return (
			<div className="bg-white p-6 rounded-md">
				<div className="flex-1 space-y-8 py-1">
					<div className="h-2 max-w-xs rounded bg-gray-200"></div>
					<div className="space-y-3">
						<div className="h-2 rounded bg-gray-200"></div>
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2 h-2 rounded bg-gray-200"></div>
							<div className="col-span-1 h-2 rounded bg-gray-200"></div>
						</div>
						<div className="h-8 max-w-[120px] rounded bg-gray-200"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<Panel header={ __( 'Core video Migration', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<p>
						{ __( 'This tool is used to replace WordPress core video blocks with GoDAM video block.', 'godam' ) }
					</p>
					<p>
						<b>{ __( 'Action:', 'godam' ) }</b> <code>core/video</code> with <code>godam/video</code>
					</p>

					{ /* Progressbar indicating video migration progress */ }
					{ /* Horizontal progressbar, done/total */ }
					{ [ 'processing', 'completed' ].includes( migrationStatus?.status ) && (
						<div>
							<ProgressBar showInitialProgress={ 'processing' === migrationStatus?.status } done={ migrationStatus?.done } total={ migrationStatus?.total } />
							<div className="mt-1 mb-3 px-1 py-[1px] bg-gray-200 inline-flex rounded">{ migrationStatus?.message }</div>
						</div>
					) }

					{ /* Migration status message */ }
					{ migrationStatus?.status === 'completed' && (
						<div className="godam-migration-status my-2">
							{ __( 'WordPress core video migration completed successfully 🎉', 'godam' ) }
						</div>
					) }
					{ migrationStatus?.status === 'failed' && (
						<div className="godam-migration-status my-2">
							{ __( 'Migration failed. Please try again.', 'godam' ) }
						</div>
					) }

					{ /* Migration button */ }
					<Button
						variant="primary"
						onClick={ handleMigrationClick }
						className="godam-button mt-2"
						disabled={ ! migrationStatus || migrationStatus?.status === 'processing' }
                	>
						{ migrationStatus?.status === 'processing' ? __( 'Migration in progress' ) : __( 'Start Migration', 'godam' ) }
					</Button>
				</PanelBody>
			</Panel>
		</>
	);
};

export default CoreVideoMigration;