/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	Notice,
	Panel,
	PanelBody,
	Button,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings';
import {
	formatSize,
	getMaxUploadSize,
	getGodamMaxUploadSize,
	scrollToTop,
} from '../../../utils';
import { updateMediaSetting } from '../../../redux/slice/media-settings';

import MediaMigration from './MediaMigration.jsx';

const UploadsSettings = () => {
	const dispatch = useDispatch();
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	const [ saveMediaSettings, { isLoading: saveMediaSettingLoading } ] = useSaveMediaSettingsMutation();

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		scrollToTop();
	};

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'uploads', key, value } ) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: { uploads: mediaSettings?.uploads } } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	const getFileUploadSize = () => {
		if ( mediaSettings.uploads?.offload_media ) {
			return formatSize( getGodamMaxUploadSize() );
		}

		return formatSize( getMaxUploadSize() );
	};

	return (
		<>
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Panel header={ __( 'Uploads Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened>

					{ ( () => {
						const offloadEnabled = !! mediaSettings?.uploads?.offload_media;
						const currentLimit = getFileUploadSize();
						const godamLimit = formatSize( getGodamMaxUploadSize() );
						const message = offloadEnabled
							? sprintf(
								// translators: %1$s is the Offload/Godam maximum upload size (e.g. "4.00 GB").
								__( 'Offload Media is enabled. You can upload files up to %1$s in size.', 'godam' ),
								currentLimit,
							)
							: sprintf(
								// translators: %1$s is the current WordPress max upload size (e.g. "100.00 MB"), %2$s is the Offload/Godam limit (e.g. "4.00 GB").
								__( 'Your current upload limit is %1$s. Enable Offload Media to upload files up to %2$s.', 'godam' ),
								currentLimit,
								godamLimit,
							);

						return (
							<Notice
								className="mb-4"
								status={ 'warning' }
								isDismissible={ false }
							>
								{ message }
							</Notice>
						);
					} )() }

					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle godam-margin-bottom"
						label={ __( 'Offload Media?', 'godam' ) }
						help={ __( 'Bypass your WordPress upload, directly send new files to the GoDAM CDN.', 'godam' ) }
						checked={ mediaSettings?.uploads?.offload_media }
						onChange={ ( value ) => handleSettingChange( 'offload_media', value ) }
					/>
				</PanelBody>
			</Panel>
			{ mediaSettings.uploads?.offload_media && (
				<MediaMigration />
			) }
			<Button
				variant="primary"
				className="godam-button"
				onClick={ handleSaveSettings }
				isBusy={ saveMediaSettingLoading }
				disabled={ saveMediaSettingLoading }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>
		</>
	);
};

export default UploadsSettings;
