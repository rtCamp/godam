/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Notice,
	ToggleControl,
	Panel,
	PanelBody,
	Button,
	Spinner,
	ExternalLink,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';

const SEO_PLUGIN_NAMES = {
	yoast: 'Yoast SEO',
	'rank-math': 'Rank Math',
	aioseo: 'All in One SEO',
};

const SeoSettings = () => {
	const dispatch = useDispatch();

	const { mediaSettings, isChanged } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
		isChanged: state.mediaSettings.isChanged,
	} ) );

	const [ saveMediaSettings, { isLoading: isSaving } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const sitemapData = window.godamVideoSitemap || {};
	const activeSeoPlugin = SEO_PLUGIN_NAMES[ sitemapData.activeSeoPlugin ] || '';
	const isSitemapEnabled = !! mediaSettings?.seo?.enable_video_sitemap;

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'seo', key, value } ) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: mediaSettings } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
				dispatch( resetChangeFlag() );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isChanged ) {
				event.preventDefault();
				event.returnValue = __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' );
			}
		};
		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => window.removeEventListener( 'beforeunload', handleBeforeUnload );
	}, [ isChanged ] );

	let whereListed = __( 'No supported SEO plugin sitemap is active, so it is listed in the WordPress sitemap index (/wp-sitemap.xml).', 'godam' );
	if ( activeSeoPlugin ) {
		whereListed = sprintf(
			/* translators: %s: SEO plugin name, e.g. Yoast SEO. */
			__( 'It is listed in the %s sitemap index.', 'godam' ),
			activeSeoPlugin,
		);
	}

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

			<div>
				<Panel header={ __( 'Video SEO', 'godam' ) } className="godam-panel">
					<PanelBody opened>
						<div data-test-id="godam-settings-seo-control-video-sitemap">
							<ToggleControl
								className="mb-4"
								label={ __( 'Enable video sitemap', 'godam' ) }
								help={ __( 'Adds a video sitemap that lists every published page containing GoDAM videos, so search engines can find them. Works with Yoast SEO, Rank Math, All in One SEO, or the WordPress sitemap. No new pages are created.', 'godam' ) }
								checked={ isSitemapEnabled }
								onChange={ ( value ) => handleSettingChange( 'enable_video_sitemap', value ) }
							/>
						</div>

						{ isSitemapEnabled && sitemapData.sitemapUrl && (
							<Notice status="info" isDismissible={ false } className="mb-4">
								<p>
									{ __( 'Video sitemap:', 'godam' ) }{ ' ' }
									<ExternalLink href={ sitemapData.sitemapUrl }>{ sitemapData.sitemapUrl }</ExternalLink>
								</p>
								<p>{ whereListed }</p>
								{ isChanged && (
									<p>{ __( 'Save your changes before opening the sitemap.', 'godam' ) }</p>
								) }
							</Notice>
						) }

						<p className="text-sm text-gray-600">
							{ __( 'To leave a single video out of the sitemap, turn on "Exclude from video sitemap" in that video\'s SEO settings in the block, Elementor widget or WPBakery element. Drafts, private, password-protected and noindexed pages are always left out.', 'godam' ) }
						</p>
					</PanelBody>
				</Panel>

				<div className="godam-settings__save-row">
					<Button
						variant="primary"
						onClick={ handleSaveSettings }
						icon={ isSaving && <Spinner /> }
						isBusy={ isSaving }
						disabled={ isSaving || ! isChanged }
						data-test-id="godam-settings-seo-button-save"
					>
						{ isSaving ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
					</Button>
				</div>
			</div>
		</>
	);
};

export default SeoSettings;
