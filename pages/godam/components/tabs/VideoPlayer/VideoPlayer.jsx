/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { Button, Notice, ComboboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting } from '../../../redux/slice/media-settings.js';
import BrandImageSelector from '../GeneralSettings/BrandImageSelector.jsx';
import CustomVideoPlayerCSS from './CustomVideoPlayerCSS.jsx';
import VideoJSPlayer from '../../../../video-editor/VideoJSPlayer.js';
import {
	useGetAttachmentMetaQuery,
} from '../../../../video-editor/redux/api/attachment.js';
import ColorPickerButton from '../../../../video-editor/components/shared/color-picker/ColorPickerButton.jsx';

const VideoPlayer = () => {
	const dispatch = useDispatch();
	const wrapperRef = useRef( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ sources, setSources ] = useState( [] );
	const [ duration, setDuration ] = useState( 0 );
	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] =
    useSaveMediaSettingsMutation();
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );
	const [ theme, setTheme ] = useState( 'Minimal' );
	// const { data: attachmentConfig } = useGetAttachmentMetaQuery( attachmentID );

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'video_player', key, value } ) );
	};

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		scrollToTop();
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( {
				settings: { video_player: mediaSettings?.video_player },
			} ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	const handleTimeUpdate = ( _, time ) => setCurrentTime( time.toFixed( 2 ) );
	const handlePlayerReady = ( player ) => {
		if ( player ) {
			const playerEl = player.el_;
			const video = playerEl.querySelector( 'video' );

			if ( video ) {
				video.addEventListener( 'loadedmetadata', () => {
					setDuration( player.duration() );
				} );
			}
		}
	};

	useEffect( () => {
		if ( ! wrapperRef.current ) {
			return;
		}

		const videoElement = document.createElement( 'video-js' );
		videoElement.classList.add( 'vjs-big-play-centered', 'video-player-settings-preview' );

		wrapperRef.current.appendChild( videoElement );

		const player = videojs( videoElement, {
			controls: true,
			autoplay: false,
			preload: 'auto',
			aspectRatio: '16:9',
			fluid: false,
			sources: [ {
				src: 'http://godam.local/wp-content/uploads/2025/06/rtcamp-video-1.mp4',
				type: 'video/mp4',
			} ],
			controlBar: {
				playToggle: true,
				volumePanel: true,
				currentTimeDisplay: true,
				timeDivider: true,
				durationDisplay: true,
				fullscreenToggle: true,
				subsCapsButton: true,
				skipButtons: {
					forward: 10,
					backward: 10,
				},
			},
		}, () => {
			console.log( 'Player is ready' );
		} );

		return () => {
			if ( player && ! player.isDisposed() ) {
				player.dispose();
			}
		};
	}, [] );

	useEffect( () => {
		const videoElement = wrapperRef.current?.querySelector( 'video-js' );
		const userSelectedStyles = {
			'--vjs-brand-color': mediaSettings?.video_player?.brand_color || '#000000',
			'--vjs-brand-image': mediaSettings?.video_player?.brand_image ? `url(${ mediaSettings?.video_player?.brand_image })` : 'none',
		};

		if ( mediaSettings?.video_player?.brand_color ) {
			userSelectedStyles[ '--vjs-control-bar-background' ] = mediaSettings?.video_player?.brand_color;
		}
		Object.keys( userSelectedStyles ).forEach( ( key ) => {
			videoElement.style.setProperty( key, userSelectedStyles[ key ] );
		} );
	}, [ mediaSettings?.video_player?.brand_color, mediaSettings?.video_player?.brand_image ] );

	const formatTimeForInput = ( seconds ) => {
		if ( seconds === null || isNaN( seconds ) ) {
			return '';
		}

		const hrs = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		const secsRaw = seconds % 60;

		const hrsStr = String( hrs ).padStart( 2, '0' );
		const minsStr = String( mins ).padStart( 2, '0' );
		const secsStr = secsRaw.toFixed( 2 ).padStart( 5, '0' ); // includes decimal, eg: 04.90

		if ( hrs > 0 ) {
			return `${ hrsStr }:${ minsStr }:${ secsStr }`;
		}
		return `${ minsStr }:${ secsStr }`;
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

			{ /* <CustomVideoPlayerCSS handleSettingChange={ handleSettingChange } /> */ }
			{ /* <VideoJSPlayer
				options={ {
					controls: true,
					fluid: true,
					preload: 'auto',
					aspectRatio: '16:9',
					sources: { src: '../../../../../../godam/assets/src/rtcamp-video.mp4', type: 'video/mp4' },
					controlBar: {
						playToggle: true,
						volumePanel: true,
						currentTimeDisplay: true,
						timeDivider: true,
						durationDisplay: true,
						fullscreenToggle: true,
						subsCapsButton: true,
						skipButtons: {
							forward: 10,
							backward: 10,
						},
					},
				} }
				onTimeupdate={ handleTimeUpdate }
				onReady={ handlePlayerReady }
				playbackTime={ currentTime }
				formatTimeForInput={ formatTimeForInput }
			/> */ }
			<div className="bg-neutral-50 p-6 rounded-lg shadow-sm">
				<div ref={ wrapperRef } className="text-center"></div>

				<div className="grid grid-cols-3 gap-6 items-start mt-8">
					<div className="godam-form-group">
						<label className="label-text" htmlFor="brand-color">
							{ __( 'Brand color', 'godam' ) }
						</label>
						<ColorPickerButton
							label={ __( 'Brand color', 'godam' ) }
							value={ mediaSettings?.video_player?.brand_color }
							onChange={ ( value ) => handleSettingChange( 'brand_color', value ) }
						/>
						<p className="help-text">
							{ __(
								'Select a brand color to apply to the video block. This can be overridden for individual videos by the video editor',
								'godam',
							) }
						</p>
					</div>
					<BrandImageSelector
						mediaSettings={ mediaSettings }
						handleSettingChange={ handleSettingChange }
					/>
					<ComboboxControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label="Player Skin"
						onChange={ ( value ) => setTheme( value ) }
						options={ [
							{
								label: 'Minimal',
								value: 'Minimal',
							},
							{
								label: 'Pills',
								value: 'Pills',
							},
							{
								label: 'Bubble',
								value: 'Bubble',
							},
						] }
						value={ theme }
					/>
				</div>

				<Button
					variant="primary"
					className="godam-button"
					onClick={ handleSaveSettings }
					isBusy={ saveMediaSettingsLoading }
					disabled={ saveMediaSettingsLoading }
				>
					{ __( 'Save Settings', 'godam' ) }
				</Button>
			</div>
		</>
	);
};

export default VideoPlayer;
