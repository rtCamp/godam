
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
import VimeoVideoMigration from './VimeoVideoMigration';

const MigrationTab = () => {
	const [ migrationStatus, setMigrationStatus ] = useState( null );
	const [ vimeoMigrationStatus, setVimeoMigrationStatus ] = useState( null );

	const fetchMigrationStatus = async ( type ) => {
		const url = window.godamRestRoute?.url + 'godam/v1/video-migration/status?type=' + type;

		try {
			const response = await axios.get( url );
			if ( type === 'core' ) {
				setMigrationStatus( response.data );
			} else if ( type === 'vimeo' ) {
				setVimeoMigrationStatus( response.data );
			}
		} catch ( error ) {
			console.error( 'Error fetching migration status:', error );
		}
	};

	useEffect( () => {
		// Check if the migration is already in progress or completed
		fetchMigrationStatus( 'core' );
		fetchMigrationStatus( 'vimeo' );
	}, [] );

	return (
		<>
			<CoreVideoMigration
				migrationStatus={ migrationStatus }
				setMigrationStatus={ setMigrationStatus }
			/>
			<VimeoVideoMigration
				migrationStatus={ vimeoMigrationStatus }
				setMigrationStatus={ setVimeoMigrationStatus }
			/>
		</>
	);
};

export default MigrationTab;
