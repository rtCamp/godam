
/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import CoreVideoMigration from './CoreVideoMigration';

const MigrationTab = () => {
	const [ migrationStatus, setMigrationStatus ] = useState( null );

	useEffect( () => {
		// Check if the migration is already in progress or completed
		const url = window.godamRestRoute?.url + 'godam/v1/vimeo-migration/status';

		axios.get( url )
			.then( ( response ) => {
				setMigrationStatus( response.data );
			} )
			.catch( ( error ) => {
				console.error( __( 'Error checking migration status: ', 'godam' ), error );
			} );
	}, [] );

	return (
		<>
			<CoreVideoMigration
				migrationStatus={ migrationStatus }
				setMigrationStatus={ setMigrationStatus }
			/>
		</>
	);
};

export default MigrationTab;
