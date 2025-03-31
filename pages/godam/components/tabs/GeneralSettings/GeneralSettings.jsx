/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	ToggleControl,
	Notice,
	Panel,
	PanelBody,
	Button,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import BrandImageSelector from './BrandImageSelector.jsx';
import ColorPickerButton from '../../../../video-editor/components/ColorPickerButton.js';

import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting } from '../../../redux/slice/media-settings.js';

import { scrollToTop } from '../../../utils/index.js';

const GeneralSettings = () => {
	const dispatch = useDispatch();
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );
	const [ saveMediaSettings ] = useSaveMediaSettingsMutation();

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		scrollToTop();
	};

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'general', key, value } ) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: { general: mediaSettings?.general } } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
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

			<Panel header={ __( 'General Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle godam-margin-bottom"
						label={ __( 'Enable folder organization in media library.', 'godam' ) }
						help={ __( 'Keep this option enabled to organize media into folders within the media library. Disabling it will remove folder organization.', 'godam' ) }
						checked={ mediaSettings?.general?.enable_folder_organization }
						onChange={ ( value ) => handleSettingChange( 'enable_folder_organization', value ) }
					/>

					<BrandImageSelector mediaSettings={ mediaSettings } handleSettingChange={ handleSettingChange } />

					<div className="godam-form-group">
						<label htmlFor="brand-color">{ __( 'Brand color', 'godam' ) }</label>
						<ColorPickerButton
							label={ __( 'Brand color', 'godam' ) }
							value={ mediaSettings?.general?.brand_color }
							onChange={ ( value ) => handleSettingChange( 'brand_color', value ) }
						/>
						<p className="help-text">
							{ __( 'Select a brand color to apply to the video block. This can be overridden for individual videos by the video editor', 'godam' ) }
						</p>
					</div>
				</PanelBody>
			</Panel>

			<Button variant="primary" className="godam-button" onClick={ handleSaveSettings }>
				{ __( 'Save Settings', 'godam' ) }
			</Button>
		</>
	);
};

export default GeneralSettings;
