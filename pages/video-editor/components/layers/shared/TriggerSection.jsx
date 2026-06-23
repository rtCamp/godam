/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../../redux/slice/videoSlice';
import { VeSection, VeRadioGroup, VeTextInput, VeSlider } from '../../controls';
import { formatClock, parseClock } from '../../../utils/time';

/**
 * Trigger types. `timestamp` maps to the existing `displayTime` behaviour
 * (the layer appears at a fixed second) and is the default so layers created
 * before triggers existed keep behaving exactly as before. The other three
 * are event-driven on the published player (watch %, user pause, video end).
 */
export const TRIGGER_OPTIONS = [
	{
		value: 'timestamp',
		label: __( 'Fixed Timestamp', 'godam' ),
		description: __( 'Appears at a set second', 'godam' ),
	},
	{
		value: 'watch_depth',
		label: __( 'Watch Depth', 'godam' ),
		description: __( 'Fires after the user crosses a watch %', 'godam' ),
	},
	{
		value: 'on_pause',
		label: __( 'On Pause', 'godam' ),
		description: __( 'Shows when the viewer pauses (single CTA only)', 'godam' ),
	},
	{
		value: 'end_of_video',
		label: __( 'End of Video', 'godam' ),
		description: __( 'Overlays on the final frame when playback ends', 'godam' ),
	},
];

/**
 * Reusable "CTA Trigger" configuration section, built on WordPress
 * `RadioControl`. The selected trigger reveals its own parameter field
 * (Start Time / Watch Percentage) below the radios. `on_pause` is mutually
 * exclusive across a video — if another CTA already uses it, the option is
 * shown with a warning and cannot be selected here.
 *
 * @param {Object} props            Props.
 * @param {string} props.layerID    Layer id.
 * @param {number} [props.duration] Video duration in seconds (bounds Start Time).
 * @param {string} [props.title]    Section title (default "CTA Trigger").
 * @return {JSX.Element} The trigger section.
 */
const TriggerSection = ( { layerID, duration, title = __( 'CTA Trigger', 'godam' ) } ) => {
	const dispatch = useDispatch();
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const layer = layers.find( ( _layer ) => _layer.id === layerID );

	const trigger = layer?.trigger || 'timestamp';

	// "On Pause" can be used by a single CTA per video.
	const onPauseTakenByOther = layers.some(
		( _layer ) => _layer.id !== layerID && _layer.trigger === 'on_pause',
	);

	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layerID, field, value } ) );
	};

	const handleStartTimeChange = ( value ) => {
		let seconds = parseClock( value );
		if ( duration ) {
			seconds = Math.min( seconds, Math.floor( duration ) );
		}
		seconds = Math.max( 0, seconds );
		updateField( 'displayTime', seconds );
	};

	const handleTriggerChange = ( value ) => {
		// Block selecting a locked "On Pause".
		if ( value === 'on_pause' && onPauseTakenByOther ) {
			return;
		}
		updateField( 'trigger', value );
	};

	const options = TRIGGER_OPTIONS.map( ( opt ) => {
		if ( opt.value === 'on_pause' && onPauseTakenByOther ) {
			return {
				...opt,
				disabled: true,
				description: __( 'Another CTA already uses On Pause — only one CTA per video can.', 'godam' ),
			};
		}
		// The selected option renders its own settings inline (see VeRadioGroup).
		if ( opt.value === 'timestamp' ) {
			return {
				...opt,
				content: (
					<VeTextInput
						label={ __( 'Start Time', 'godam' ) }
						value={ formatClock( layer?.displayTime ) }
						onChange={ handleStartTimeChange }
						placeholder="0:00"
					/>
				),
			};
		}
		if ( opt.value === 'watch_depth' ) {
			return {
				...opt,
				content: (
					<VeSlider
						value={ layer?.watchDepth ?? 50 }
						onChange={ ( value ) => updateField( 'watchDepth', value ) }
						min={ 1 }
						max={ 100 }
						step={ 1 }
					/>
				),
			};
		}
		return opt;
	} );

	return (
		<VeSection title={ title }>
			<VeRadioGroup
				name={ `godam-ve-trigger-${ layerID }` }
				options={ options }
				value={ trigger }
				onChange={ handleTriggerChange }
			/>
		</VeSection>
	);
};

export default TriggerSection;
