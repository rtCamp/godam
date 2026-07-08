/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LayersTabIcon, SettingsTabIcon, TranscriptTabIcon, ChaptersTabIcon } from './icons';

/**
 * Definitions for every tab the shell knows how to render, keyed by name. The
 * capability descriptor decides which of these appear (and in what order) for
 * the current media type.
 */
const TAB_DEFINITIONS = {
	layers: { label: __( 'Layers', 'godam' ), icon: LayersTabIcon },
	'player-settings': { label: __( 'Settings', 'godam' ), icon: SettingsTabIcon },
	transcription: { label: __( 'Transcription', 'godam' ), icon: TranscriptTabIcon },
	chapters: { label: __( 'Chapters', 'godam' ), icon: ChaptersTabIcon },
};

const DEFAULT_TABS = [ 'layers', 'player-settings', 'transcription', 'chapters' ];

/**
 * Vertical icon rail that switches the active editor section.
 *
 * The tab list is supplied by the active media-type capability (`tabs`) so
 * audio shows only Transcription + Chapters while video shows all four. Tab
 * names match the Redux `currentTab` values.
 *
 * @param {Object}   props
 * @param {string}   props.currentTab Active tab name.
 * @param {string[]} props.tabs       Ordered tab names to show. Defaults to all.
 * @param {Function} props.onSelect   Called with the selected tab name.
 * @return {JSX.Element} The tab rail.
 */
const EditorTabRail = ( { currentTab, tabs = DEFAULT_TABS, onSelect } ) => {
	const railTabs = tabs
		.filter( ( name ) => TAB_DEFINITIONS[ name ] )
		.map( ( name ) => ( { name, ...TAB_DEFINITIONS[ name ] } ) );

	return (
		<nav className="godam-video-editor__rail" aria-label={ __( 'Editor sections', 'godam' ) }>
			{ railTabs.map( ( tab ) => (
				<Button
					key={ tab.name }
					className="godam-video-editor__rail-button"
					icon={ tab.icon }
					label={ tab.label }
					showTooltip
					isPressed={ currentTab === tab.name }
					aria-current={ currentTab === tab.name ? 'page' : undefined }
					onClick={ () => onSelect( tab.name ) }
				/>
			) ) }
		</nav>
	);
};

export default EditorTabRail;
