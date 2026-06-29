/**
 * Video Editor list view — DataViews-powered videos grid.
 *
 * Replaces the bespoke AttachmentPicker / MediaGrid / MediaItem stack with a
 * single `@wordpress/dataviews` grid. Data is fetched server-side (paginated /
 * sorted / filtered / searched by the `godam/v1/video-editor/videos` REST
 * endpoint); the component accumulates pages and appends the next page on
 * demand via a manual "Load more" button (see `loadMore`). DataViews' own
 * search / filter / sort / pagination chrome is hidden (see video-dataview.scss)
 * — a custom toolbar drives the query, mirroring the provided design.
 *
 * @package
 */

/**
 * External dependencies
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { createPortal } from '@wordpress/element';
import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	NavigableMenu,
	Snackbar,
	Tooltip,
} from '@wordpress/components';
import { DataViews } from '@wordpress/dataviews';
import {
	Icon,
	chevronDown,
	check,
	info,
	moreHorizontal,
	search as searchIcon,
	edit as editIcon,
	video as videoIcon,
	copy as copyIcon,
	chartBar as analyticsIcon,
	media as mediaIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { copyGoDAMVideoBlock, prefetchMediaDataForCopy } from '../../utils';
import { notify as notifyGuide, start as startGuide } from '../../onboarding/productGuide';
import { useGetVideoEditorVideosMutation } from '../../redux/api/video-editor';
import { canManageAttachment } from '../../../../assets/src/js/media-library/utility.js';
import { LayersTabIcon } from '../editor-shell/icons';
import NoThumbnailImage from '../../assets/no-thumbnail.jpg';
import GodamIcon from '../../../../assets/src/images/godam-logo-gradient.svg';
import '@wordpress/dataviews/build-style/style.css';
import './video-dataview.scss';

const PER_PAGE = 20;

/**
 * "All Videos" filter options. `key` is sent to the REST endpoint as `filter`.
 */
const FILTER_OPTIONS = [
	{ key: 'all', label: __( 'All Videos', 'godam' ) },
	{ key: 'edited', label: __( 'Edited Videos', 'godam' ) },
	{ key: 'unedited', label: __( 'Unedited Videos', 'godam' ) },
	{ key: 'transcoded', label: __( 'Transcoded videos', 'godam' ) },
	{ key: 'non_transcoded', label: __( 'Non Transcoded', 'godam' ) },
];

/**
 * "Recently Edited" sort options, mapped to REST `orderby` / `order`.
 */
const SORT_OPTIONS = [
	{ key: 'newest', label: __( 'Newest Uploaded', 'godam' ), orderby: 'date', order: 'desc' },
	{ key: 'oldest', label: __( 'Oldest Uploaded', 'godam' ), orderby: 'date', order: 'asc' },
	{ key: 'recently_edited', label: __( 'Recently Edited', 'godam' ), orderby: 'modified', order: 'desc' },
	{ key: 'name_asc', label: __( 'Name A-Z', 'godam' ), orderby: 'title', order: 'asc' },
	{ key: 'name_desc', label: __( 'Name Z-A', 'godam' ), orderby: 'title', order: 'desc' },
];

const DEFAULT_VIEW = {
	type: 'grid',
	page: 1,
	perPage: PER_PAGE,
	search: '',
	filters: [],
	sort: {},
	fields: [],
	titleField: 'title',
	mediaField: 'thumbnail',
	descriptionField: 'meta',
	// The whole footer (title + kebab + details) is rendered together inside the
	// `meta` field so it can live in one padded wrapper, so DataViews' own title
	// row is disabled (and hidden in CSS as a safety net).
	showTitle: false,
	showMedia: true,
	showDescription: true,
	layout: {},
};

/**
 * Labelled dropdown used for the filter / sort toolbar controls. Renders a
 * button showing the current selection that opens a single-select menu.
 *
 * @param {Object}   props
 * @param {string}   props.label              Accessible label / aria for the control.
 * @param {Array}    props.options            `{ key, label }` options.
 * @param {string}   props.value              Currently selected option key.
 * @param {Function} props.onChange           Called with the selected option key.
 * @param {string}   [props.toggleTestId]     data-test-id for the toggle button (E2E hook).
 * @param {string}   [props.itemTestIdPrefix] Prefix for each menu item's data-test-id; the option key is appended.
 * @return {JSX.Element} Dropdown control.
 */
const ToolbarDropdown = ( { label, options, value, onChange, toggleTestId, itemTestIdPrefix } ) => {
	const selected = options.find( ( o ) => o.key === value ) || options[ 0 ];

	return (
		<Dropdown
			className="godam-ve-toolbar__dropdown"
			contentClassName="godam-ve-toolbar__dropdown-menu"
			popoverProps={ { placement: 'bottom-end' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					className="godam-ve-toolbar__dropdown-toggle"
					data-test-id={ toggleTestId }
					onClick={ onToggle }
					aria-expanded={ isOpen }
					aria-label={ label }
				>
					<span>{ selected.label }</span>
					<Icon icon={ chevronDown } size={ 20 } />
				</Button>
			) }
			renderContent={ ( { onClose } ) => (
				<NavigableMenu role="menu" orientation="vertical">
					<MenuGroup>
						{ options.map( ( option ) => (
							<MenuItem
								key={ option.key }
								data-test-id={ `${ itemTestIdPrefix }${ option.key }` }
								role="menuitemradio"
								isSelected={ option.key === value }
								icon={ option.key === value ? check : undefined }
								onClick={ () => {
									onChange( option.key );
									onClose();
								} }
							>
								{ option.label }
							</MenuItem>
						) ) }
					</MenuGroup>
				</NavigableMenu>
			) }
		/>
	);
};

/**
 * Per-card "…" actions menu (Preview / Copy / Analytics). Rendered inside the
 * card footer so the whole footer can live in a single wrapper — replaces
 * DataViews' built-in ItemActions kebab.
 *
 * @param {Object}   props
 * @param {Object}   props.item   Video item.
 * @param {Function} props.onCopy Copy-to-clipboard handler.
 * @return {JSX.Element} Dropdown menu.
 */
const CardActionsMenu = ( { item, onCopy } ) => {
	const adminUrl =
		window?.videoData?.adminUrl || window?.pluginInfo?.adminUrl || '/wp-admin/';

	return (
		<Dropdown
			className="godam-ve-card__menu"
			popoverProps={ { placement: 'bottom-end' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					className="godam-ve-card__menu-toggle"
					icon={ moreHorizontal }
					label={ __( 'Quick actions', 'godam' ) }
					aria-expanded={ isOpen }
					onClick={ ( event ) => {
						event.stopPropagation();
						onToggle();
					} }
				/>
			) }
			renderContent={ ( { onClose } ) => (
				<NavigableMenu role="menu" orientation="vertical">
					<MenuGroup>
						<MenuItem
							role="menuitem"
							icon={ videoIcon }
							onClick={ () => {
								window.open( `/?godam_page=video-preview&id=${ item.id }`, '_blank' );
								onClose();
							} }
						>
							{ __( 'Preview Video', 'godam' ) }
						</MenuItem>
						<MenuItem
							role="menuitem"
							icon={ copyIcon }
							onClick={ () => {
								onCopy( item );
								onClose();
							} }
						>
							{ __( 'Copy Video', 'godam' ) }
						</MenuItem>
						<MenuItem
							role="menuitem"
							icon={ analyticsIcon }
							onClick={ () => {
								window.open( `${ adminUrl }admin.php?page=rtgodam_analytics&id=${ item.id }`, '_blank' );
								onClose();
							} }
						>
							{ __( 'View Analytics', 'godam' ) }
						</MenuItem>
					</MenuGroup>
				</NavigableMenu>
			) }
		/>
	);
};

const VideoEditorDataView = ( { onEdit } ) => {
	const [ getVideos ] = useGetVideoEditorVideosMutation();
	const [ view, setView ] = useState( DEFAULT_VIEW );

	// Query state (drives the REST request, independent of DataViews' hidden
	// built-in controls).
	const [ search, setSearch ] = useState( '' );
	const [ filter, setFilter ] = useState( 'all' );
	const [ sortKey, setSortKey ] = useState( 'newest' );

	// Accumulated infinite-scroll state.
	const [ items, setItems ] = useState( [] );
	const [ page, setPage ] = useState( 1 );
	const [ hasMore, setHasMore ] = useState( true );
	const [ total, setTotal ] = useState( 0 );
	// Start in the fetching state so the empty placeholder doesn't flash before
	// the first request kicks off on mount.
	const [ fetching, setFetching ] = useState( true );

	// Copy-to-clipboard feedback.
	const [ snackbarMessage, setSnackbarMessage ] = useState( '' );
	const [ showSnackbar, setShowSnackbar ] = useState( false );

	const requestIdRef = useRef( 0 );

	const sortOption = useMemo(
		() => SORT_OPTIONS.find( ( o ) => o.key === sortKey ) || SORT_OPTIONS[ 0 ],
		[ sortKey ],
	);

	// Reset accumulation whenever the query parameters change.
	const resetCollection = useCallback( () => {
		setItems( [] );
		setPage( 1 );
		setHasMore( true );
	}, [] );

	const handleSearchChange = ( event ) => {
		setSearch( event.target.value );
		resetCollection();
	};

	const handleFilterChange = ( key ) => {
		setFilter( key );
		resetCollection();
	};

	const handleSortChange = ( key ) => {
		setSortKey( key );
		resetCollection();
	};

	// Fetch the current page directly via the REST endpoint. Modelled on the
	// legacy MediaGrid effect: debounce, stale-request guard, append on
	// subsequent pages and replace on page 1.
	useEffect( () => {
		const currentRequestId = ++requestIdRef.current;
		setFetching( true );

		const run = async () => {
			const response = await getVideos( {
				page,
				perPage: PER_PAGE,
				search,
				orderby: sortOption.orderby,
				order: sortOption.order,
				filter,
			} );

			// Ignore responses for superseded requests.
			if ( requestIdRef.current !== currentRequestId ) {
				return;
			}

			if ( response?.error ) {
				setHasMore( false );
				setFetching( false );
				return;
			}

			const fetched = response?.data?.items || [];
			const totalPages = Number( response?.data?.paginationInfo?.totalPages ) || 0;

			setTotal( Number( response?.data?.paginationInfo?.totalItems ) || 0 );
			setItems( ( prev ) => ( page === 1 ? fetched : [ ...prev, ...fetched ] ) );

			if ( ( totalPages && page >= totalPages ) || fetched.length === 0 ) {
				setHasMore( false );
			}

			setFetching( false );
		};

		const debounce = setTimeout( run, search ? 400 : 0 );
		return () => clearTimeout( debounce );
	}, [ getVideos, search, filter, sortOption.orderby, sortOption.order, page ] );

	// Load the next page on demand (manual "Load more" button).
	const loadMore = useCallback( () => {
		setPage( ( prev ) => prev + 1 );
	}, [] );

	const handleCopyVideo = useCallback( async ( item ) => {
		const result = await copyGoDAMVideoBlock( item.id );
		setSnackbarMessage(
			result
				? __( 'GoDAM Video Block copied to clipboard', 'godam' )
				: __( 'Failed to copy GoDAM Video Block', 'godam' ),
		);
		setShowSnackbar( true );
	}, [] );

	// Prefetch copy payloads for the currently loaded videos so the Copy action
	// is instant (mirrors the legacy MediaItem behaviour).
	useEffect( () => {
		items.forEach( ( item ) => prefetchMediaDataForCopy( item.id ) );
	}, [ items ] );

	const fields = useMemo(
		() => [
			{
				id: 'thumbnail',
				label: __( 'Thumbnail', 'godam' ),
				enableSorting: false,
				enableHiding: false,
				render: ( { item } ) => {
					const isFallback =
						! item?.thumbnail ||
						item.thumbnail.includes( '.svg' ) ||
						item.thumbnail.includes( 'no-thumbnail' ) ||
						item.thumbnail.includes( 'default' );

					return (
						<>
							<div
								className="godam-ve-card__media-frame"
								data-test-id={ `godam-video-editor-element-card-${ item.id }` }
							>
								<img
									src={ isFallback ? NoThumbnailImage : item.thumbnail }
									alt={ item.title || '' }
									className={ `godam-ve-card__thumb ${ isFallback ? 'is-fallback' : '' }` }
								/>

								{ item.fileLength && (
									<span className="godam-ve-card__duration">{ item.fileLength }</span>
								) }

								{ canManageAttachment( item.author ) && (
									<div className="godam-ve-card__edit-overlay">
										<Button
											variant="primary"
											icon={ editIcon }
											data-test-id={ `godam-video-editor-button-edit-${ item.id }` }
											className="godam-ve-card__edit-button"
											onClick={ ( event ) => {
												event.stopPropagation();
												// Advance the product guide's "open a video" step.
												notifyGuide( 'edit-video' );
												onEdit( item.id );
											} }
										>
											{ __( 'Edit', 'godam' ) }
										</Button>
									</div>
								) }
							</div>

							{ item.godamCentral && (
								<Tooltip text={ __( 'Sourced from GoDAM Central', 'godam' ) }>
									<span className="godam-ve-card__source-badge">
										<img src={ GodamIcon } alt="" aria-hidden="true" />
									</span>
								</Tooltip>
							) }
						</>
					);
				},
			},
			{
				id: 'title',
				label: __( 'Video name', 'godam' ),
				enableGlobalSearch: true,
				getValue: ( { item } ) => item.title || '',
				render: ( { item } ) => (
					<span className="godam-ve-card__title">{ item.title }</span>
				),
			},
			{
				id: 'meta',
				label: __( 'Details', 'godam' ),
				enableSorting: false,
				enableHiding: false,
				getValue: ( { item } ) => item.modifiedFormatted || '',
				render: ( { item } ) => (
					<div className="godam-ve-card__footer">
						<div className="godam-ve-card__title-row">
							<h3 className="godam-ve-card__title">{ item.title }</h3>
							<CardActionsMenu item={ item } onCopy={ handleCopyVideo } />
						</div>
						<span className="godam-ve-card__date">
							{ sprintf(
								/* translators: %s: human-readable date the video was last edited. */
								__( 'Last edited %s', 'godam' ),
								item.modifiedFormatted || '—',
							) }
						</span>
						<div className="godam-ve-card__stats">
							<span className="godam-ve-card__layers" title={ __( 'Layers', 'godam' ) }>
								<LayersTabIcon />
								{ item.layersCount || 0 }
							</span>
							{ item.transcodeStatus !== 'transcoded' && (
								<span className="godam-ve-card__badge godam-ve-card__badge--warning">
									<Icon icon={ info } size={ 16 } />
									{ __( 'Non Transcoded', 'godam' ) }
								</span>
							) }
						</div>
					</div>
				),
			},
		],
		[ onEdit, handleCopyVideo ],
	);

	const defaultLayouts = useMemo(
		() => ( {
			grid: {
				layout: {
					primaryField: 'title',
					mediaField: 'thumbnail',
					columnFields: [],
				},
			},
		} ),
		[],
	);

	const paginationInfo = useMemo(
		() => ( { totalItems: total, totalPages: 1 } ),
		[ total ],
	);

	const onChangeView = useCallback( ( next ) => setView( next ), [] );

	const isInitialLoading = fetching && items.length === 0;
	const isEmpty = ! fetching && items.length === 0;

	return (
		<div className="godam-ve-list">
			<div className="godam-ve-list__header">
				<div className="godam-ve-list__heading">
					<h1 className="godam-ve-list__title">{ __( 'Video Editor', 'godam' ) }</h1>
					<p className="godam-ve-list__subtitle">
						{ __( 'Upload videos to WordPress Media Library, GoDAM auto-syncs them here.', 'godam' ) }
					</p>
				</div>
				<Button
					className="godam-ve-list__how-it-works"
					onClick={ () => startGuide() }
					data-test-id="godam-video-editor-button-how-it-works"
				>
					<Icon icon={ videoIcon } size={ 20 } />
					{ __( 'See how it works', 'godam' ) }
				</Button>
			</div>

			<div className="godam-ve-toolbar" data-test-id="godam-video-editor-toolbar-list">
				<div className="godam-ve-toolbar__search">
					<Icon icon={ searchIcon } size={ 20 } />
					<input
						type="text"
						data-test-id="godam-video-editor-control-search"
						value={ search }
						placeholder={ __( 'Search', 'godam' ) }
						onChange={ handleSearchChange }
						aria-label={ __( 'Search videos', 'godam' ) }
					/>
				</div>

				<div className="godam-ve-toolbar__filters">
					<ToolbarDropdown
						label={ __( 'Filter videos', 'godam' ) }
						options={ FILTER_OPTIONS }
						value={ filter }
						onChange={ handleFilterChange }
						toggleTestId="godam-video-editor-button-filter"
						itemTestIdPrefix="godam-video-editor-control-filter-"
					/>
					<ToolbarDropdown
						label={ __( 'Sort videos', 'godam' ) }
						options={ SORT_OPTIONS }
						value={ sortKey }
						onChange={ handleSortChange }
						toggleTestId="godam-video-editor-button-sort"
						itemTestIdPrefix="godam-video-editor-control-sort-"
					/>
				</div>
			</div>

			{ isEmpty ? (
				<div className="godam-ve-list__empty" data-test-id="godam-video-editor-content-empty">
					<Icon icon={ mediaIcon } size={ 120 } />
					<h2>{ __( 'You have no media yet!', 'godam' ) }</h2>
					<p>
						{ __( 'Upload videos to the', 'godam' ) }{ ' ' }
						<a
							href={ `${ window?.videoData?.adminUrl || '/wp-admin/' }upload.php` }
							target="_blank"
							rel="noopener noreferrer"
						>
							{ __( 'WordPress Media Library', 'godam' ) }
						</a>{ ' ' }
						{ __( 'and GoDAM will sync them here.', 'godam' ) }
					</p>
					{ window?.videoData?.wooActive && (
						<p>{ __( 'You can start selling as soon as you add a product.', 'godam' ) }</p>
					) }
				</div>
			) : (
				<DataViews
					data-test-id="godam-video-editor-content-list"
					data={ items }
					fields={ fields }
					view={ view }
					onChangeView={ onChangeView }
					defaultLayouts={ defaultLayouts }
					paginationInfo={ paginationInfo }
					getItemId={ ( item ) => String( item.id ) }
					isLoading={ isInitialLoading }
					search={ false }
					onClickItem={ ( item ) => {
						if ( canManageAttachment( item.author ) ) {
							notifyGuide( 'edit-video' );
							onEdit( item.id );
						}
					} }
					isItemClickable={ ( item ) => canManageAttachment( item.author ) }
				/>
			) }

			{ /* "Showing X of Y" count + manual Load more button. */ }
			{ items.length > 0 && (
				<div className="godam-ve-list__loadmore">
					<p className="godam-ve-list__count" data-test-id="godam-video-editor-element-count">
						{ sprintf(
							/* translators: 1: number of loaded media items, 2: total media items. */
							__( 'Showing %1$d of %2$d media items', 'godam' ),
							items.length,
							total,
						) }
					</p>
					{ hasMore && (
						<Button
							variant="secondary"
							data-test-id="godam-video-editor-button-load-more"
							className="godam-ve-list__loadmore-button"
							onClick={ loadMore }
							isBusy={ fetching }
							disabled={ fetching }
						>
							{ __( 'Load more', 'godam' ) }
						</Button>
					) }
				</div>
			) }

			{ showSnackbar &&
				createPortal(
					<Snackbar
						className="godam-ve-snackbar"
						onRemove={ () => setShowSnackbar( false ) }
					>
						{ snackbarMessage }
					</Snackbar>,
					document.body,
				) }
		</div>
	);
};

export default VideoEditorDataView;
