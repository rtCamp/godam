/**
 * WordPress dependencies
 */
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
	MediaUpload,
	MediaUploadCheck,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	PanelBody,
	RangeControl,
	SelectControl,
	ToggleControl,
	FormTokenField,
	DatePicker,
	Popover,
	Notice,
	Spinner,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
	Button,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { columns, grid, listView, plus } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './editor.scss';

const ALLOWED_BLOCKS = [ 'godam/gallery-v2-item' ];
const performanceModeOptions = [
	{ label: __( 'Balanced', 'godam' ), value: 'balanced' },
	{ label: __( 'Priority', 'godam' ), value: 'priority' },
];
const performanceModeHelpText = {
	balanced: __( 'Recommended for most videos. Loads thumbnails as visitors scroll and prepares the video just before they reach it. Best for overall page performance.', 'godam' ),
	priority: __( 'For hero videos above the fold. Loads the thumbnail immediately and prepares the video for the fastest possible first play. Use sparingly - one or two per page.', 'godam' ),
};

const formatDisplayDate = ( dateString ) => {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );

	return date.toLocaleDateString( 'en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
};

const getStoredDateValue = ( dateString, type ) => {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();

	if ( type === 'start' ) {
		return new Date( year, month, day, 0, 0, 0, 0 ).toISOString();
	}

	return new Date( year, month, day, 23, 59, 59, 999 ).toISOString();
};

const getRelativeDate = ( days ) => {
	const date = new Date();
	date.setDate( date.getDate() - days );
	date.setHours( 0, 0, 0, 0 );
	return date.toISOString();
};

const parseIdList = ( value = '' ) =>
	value
		.split( ',' )
		.map( ( item ) => item.trim() )
		.filter( Boolean );

const getVideoThumbnail = ( media ) =>
	media?.meta?.rtgodam_media_video_thumbnail ||
	media?.media_details?.sizes?.medium?.source_url ||
	media?.media_details?.sizes?.thumbnail?.source_url ||
	media?.icon ||
	'';

const normalizeTokenValue = ( value = '' ) => value.trim().toLowerCase();

const resolveBlockGap = ( style ) => {
	const raw = style?.spacing?.blockGap;

	if ( ! raw ) {
		return '16px';
	}

	if ( typeof raw === 'string' && raw.startsWith( 'var:preset|spacing|' ) ) {
		return `var(--wp--preset--spacing--${ raw.replace( 'var:preset|spacing|', '' ) })`;
	}

	return raw;
};

const getPreviewQueryArgs = ( attributes ) => {
	const {
		count,
		orderby,
		order,
		mediaFolder,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
	} = attributes;

	const mediaFolderIds = parseIdList( mediaFolder ).map( ( value ) => parseInt( value, 10 ) ).filter( ( value ) => ! Number.isNaN( value ) && value > 0 );
	const authorIds = parseIdList( author ).map( ( value ) => parseInt( value, 10 ) ).filter( ( value ) => ! Number.isNaN( value ) && value > 0 );
	const queryArgs = {
		per_page: count,
		orderby,
		order,
		status: 'inherit',
		media_type: 'video',
	};

	if ( mediaFolderIds.length ) {
		queryArgs[ 'media-folder' ] = mediaFolderIds.join( ',' );
	}

	if ( authorIds.length ) {
		queryArgs.author = authorIds.join( ',' );
	}

	if ( dateRange === '7days' ) {
		queryArgs.after = getRelativeDate( 7 );
	}

	if ( dateRange === '30days' ) {
		queryArgs.after = getRelativeDate( 30 );
	}

	if ( dateRange === '90days' ) {
		queryArgs.after = getRelativeDate( 90 );
	}

	if ( dateRange === 'custom' ) {
		if ( customDateStart ) {
			queryArgs.after = customDateStart;
		}

		if ( customDateEnd ) {
			queryArgs.before = customDateEnd;
		}
	}

	return queryArgs;
};

const AddVideoAppender = ( { onSelect } ) => (
	<MediaUploadCheck>
		<MediaUpload
			allowedTypes={ [ 'video' ] }
			onSelect={ onSelect }
			render={ ( { open } ) => (
				<Button
					className="godam-gallery-v2__add-video-button"
					variant="secondary"
					onClick={ open }
					icon={ plus }
					label={ __( 'Add New Video', 'godam' ) }
					showTooltip
					aria-label={ __( 'Add New Video', 'godam' ) }
				/>
			) }
		/>
	</MediaUploadCheck>
);

export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		mode,
		itemWidth,
		count,
		orderby,
		order,
		viewRatio,
		infiniteScroll,
		enableMoreItems,
		moreItemsBehavior,
		mediaFolder,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
		showTitle,
		layout,
		performanceMode,
		engagements,
	} = attributes;
	const showEngagementSetting = window?.godamSettings?.enableGlobalVideoEngagement ?? false;
	const [ startDatePopoverOpen, setStartDatePopoverOpen ] = useState( false );
	const [ endDatePopoverOpen, setEndDatePopoverOpen ] = useState( false );
	const [ dateError, setDateError ] = useState( '' );
	const { insertBlocks, updateBlockAttributes } = useDispatch( blockEditorStore );

	// Tracks {virtualId, blockClientId} pairs for GoDAM virtual insertions
	// so the godam-virtual-attachment-created event can update the correct block.
	const pendingVirtualInserts = useRef( [] );

	const { mediaFolders, authors, queryPreviewVideos, wasJustInserted } = useSelect(
		( select ) => {
			const coreSelect = select( coreStore );
			const blockEditorSelect = select( blockEditorStore );
			const queryArgs = getPreviewQueryArgs( attributes );

			return {
				mediaFolders: coreSelect.getEntityRecords( 'taxonomy', 'media-folder', { per_page: -1 } ),
				authors: coreSelect.getUsers( { per_page: -1 } ),
				queryPreviewVideos:
					mode === 'query'
						? coreSelect.getEntityRecords( 'postType', 'attachment', queryArgs )
						: [],
				wasJustInserted:
					blockEditorSelect.wasBlockJustInserted( clientId, 'inserter' ) ||
					blockEditorSelect.wasBlockJustInserted( clientId, 'directInsert' ) ||
					blockEditorSelect.wasBlockJustInserted( clientId, 'transform' ),
			};
		},
		[ attributes, clientId, mode ],
	);

	useEffect( () => {
		if (
			mode !== 'query' ||
			! wasJustInserted ||
			typeof enableMoreItems !== 'undefined' ||
			typeof moreItemsBehavior !== 'undefined'
		) {
			return;
		}

		setAttributes( {
			enableMoreItems: false,
			moreItemsBehavior: 'button',
			infiniteScroll: false,
		} );
	}, [
		enableMoreItems,
		infiniteScroll,
		mode,
		moreItemsBehavior,
		setAttributes,
		wasJustInserted,
	] );

	const resolvedEnableMoreItems =
		typeof enableMoreItems === 'boolean' ? enableMoreItems : true;
	const isCarouselLayout = layout === 'carousel';
	const resolvedMoreItemsBehavior =
		isCarouselLayout && resolvedEnableMoreItems
			? 'infinite'
			: moreItemsBehavior || ( infiniteScroll ? 'infinite' : 'button' );

	const updateMoreItemsSettings = ( nextEnableMoreItems, nextBehavior = resolvedMoreItemsBehavior ) => {
		const behavior =
			isCarouselLayout && nextEnableMoreItems ? 'infinite' : nextBehavior;

		setAttributes( {
			enableMoreItems: nextEnableMoreItems,
			moreItemsBehavior: behavior,
			infiniteScroll: nextEnableMoreItems && behavior === 'infinite',
		} );
	};

	useEffect( () => {
		if (
			mode !== 'query' ||
			! isCarouselLayout ||
			! resolvedEnableMoreItems ||
			moreItemsBehavior === 'infinite' ||
			infiniteScroll
		) {
			return;
		}

		setAttributes( {
			moreItemsBehavior: 'infinite',
			infiniteScroll: true,
		} );
	}, [
		infiniteScroll,
		isCarouselLayout,
		mode,
		moreItemsBehavior,
		resolvedEnableMoreItems,
		setAttributes,
	] );

	const blockGap = resolveBlockGap( attributes.style );

	const itemWidthMap = { S: 200, M: 260, L: 320 };
	const itemWidthPx = itemWidthMap[ itemWidth ] || itemWidthMap.M;

	const blockProps = useBlockProps( {
		className: `godam-gallery-v2 godam-gallery-v2--${ mode }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidthPx }px`,
			'--godam-gallery-gap': blockGap,
		},
	} );

	const mediaFolderOptions = useMemo(
		() =>
			( mediaFolders || [] ).map( ( folder ) => ( {
				id: folder.id.toString(),
				value: folder.name,
			} ) ),
		[ mediaFolders ],
	);

	const authorOptions = useMemo(
		() =>
			( authors || [] ).map( ( item ) => ( {
				id: item.id,
				value: item.name,
			} ) ),
		[ authors ],
	);

	const selectedMediaFolderToken = useMemo(
		() =>
			parseIdList( mediaFolder )
				.map( ( id ) => mediaFolderOptions.find( ( option ) => option.id === id )?.value )
				.filter( Boolean ),
		[ mediaFolder, mediaFolderOptions ],
	);

	const selectedAuthorToken = useMemo(
		() =>
			parseIdList( author )
				.map( ( id ) => authorOptions.find( ( option ) => `${ option.id }` === id )?.value )
				.filter( Boolean ),
		[ author, authorOptions ],
	);

	const mediaFolderSuggestions = useMemo(
		() => mediaFolderOptions.map( ( option ) => option.value ),
		[ mediaFolderOptions ],
	);

	const authorSuggestions = useMemo(
		() => authorOptions.map( ( option ) => option.value ),
		[ authorOptions ],
	);

	const insertHandpickedVideo = useCallback(
		( mediaItem ) => {
			if ( ! mediaItem?.id ) {
				return;
			}

			const numericId = parseInt( mediaItem.id, 10 );
			const isVirtual = ! ( numericId > 0 && String( numericId ) === String( mediaItem.id ) );

			const newBlock = createBlock( 'godam/gallery-v2-item', {
				videoId: isVirtual ? 0 : numericId,
			} );

			if ( isVirtual ) {
				pendingVirtualInserts.current.push( {
					virtualId: mediaItem.id,
					blockClientId: newBlock.clientId,
				} );
			}

			insertBlocks( newBlock, undefined, clientId );
		},
		[ clientId, insertBlocks ],
	);

	// When GoDAM creates a real WP attachment, find the pending child block
	// and set its videoId to the actual attachment ID.
	useEffect( () => {
		const handleVirtualAttachmentCreated = ( event ) => {
			const { attachment, virtualMediaId } = event.detail || {};
			if ( ! attachment?.id || ! virtualMediaId ) {
				return;
			}

			const idx = pendingVirtualInserts.current.findIndex(
				( entry ) => String( entry.virtualId ) === String( virtualMediaId ),
			);

			if ( idx === -1 ) {
				return;
			}

			const [ { blockClientId } ] = pendingVirtualInserts.current.splice( idx, 1 );
			updateBlockAttributes( blockClientId, { videoId: attachment.id } );
		};

		document.addEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );

		return () => {
			document.removeEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );
		};
	}, [ updateBlockAttributes ] );

	const renderVideoAppender = useCallback(
		() => <AddVideoAppender onSelect={ insertHandpickedVideo } />,
		[ insertHandpickedVideo ],
	);

	const updateMediaFolderToken = ( tokens ) => {
		if ( ! tokens.length ) {
			setAttributes( { mediaFolder: '' } );
			return;
		}

		const selectedIds = tokens
			.map( ( token ) =>
				mediaFolderOptions.find(
					( option ) => normalizeTokenValue( option.value ) === normalizeTokenValue( token ),
				)?.id,
			)
			.filter( Boolean );

		setAttributes( {
			mediaFolder: selectedIds.join( ',' ),
		} );
	};

	const updateAuthorToken = ( tokens ) => {
		if ( ! tokens.length ) {
			setAttributes( { author: '' } );
			return;
		}

		const selectedIds = tokens
			.map( ( token ) =>
				authorOptions.find(
					( option ) => normalizeTokenValue( option.value ) === normalizeTokenValue( token ),
				)?.id,
			)
			.filter( Boolean );

		setAttributes( {
			author: selectedIds.join( ',' ),
		} );
	};

	const previewItems = useMemo( () => {
		if ( mode !== 'query' || ! Array.isArray( queryPreviewVideos ) ) {
			return [];
		}

		return queryPreviewVideos.map( ( video ) => ( {
			id: video.id,
			title: video.title?.rendered || __( 'Untitled video', 'godam' ),
			date: video.date,
			thumbnail: getVideoThumbnail( video ),
		} ) );
	}, [ mode, queryPreviewVideos ] );

	const handleDateChange = ( nextDate, type ) => {
		if ( ! nextDate ) {
			setDateError( '' );
			setAttributes( {
				[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: '',
			} );
			return;
		}

		const selectedDate = new Date( nextDate );
		selectedDate.setHours( 0, 0, 0, 0 );

		const compareDate = new Date( type === 'start' ? customDateEnd : customDateStart );
		if ( ! Number.isNaN( compareDate.getTime() ) ) {
			compareDate.setHours( 0, 0, 0, 0 );
		}

		if ( ! Number.isNaN( compareDate.getTime() ) ) {
			if ( type === 'start' && selectedDate > compareDate ) {
				setDateError( __( 'Start date cannot be later than end date.', 'godam' ) );
				return;
			}

			if ( type === 'end' && selectedDate < compareDate ) {
				setDateError( __( 'End date cannot be earlier than start date.', 'godam' ) );
				return;
			}
		}

		setDateError( '' );
		setAttributes( {
			[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: getStoredDateValue( nextDate, type ),
		} );
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Source', 'godam' ) } initialOpen={ true }>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Gallery Source', 'godam' ) }
						value={ mode }
						onChange={ ( value ) => {
							if ( value ) {
								setAttributes( { mode: value } );
							}
						} }
					>
						<ToggleGroupControlOption value="handpicked" label={ __( 'Handpicked', 'godam' ) } />
						<ToggleGroupControlOption value="query" label={ __( 'Query', 'godam' ) } />
					</ToggleGroupControl>
				</PanelBody>

				<PanelBody title={ __( 'Gallery Settings', 'godam' ) } initialOpen={ true }>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Layout', 'godam' ) }
						value={ layout }
						onChange={ ( value ) => {
							if ( ! value ) {
								return;
							}

							if ( value === 'carousel' && resolvedEnableMoreItems ) {
								setAttributes( {
									layout: value,
									moreItemsBehavior: 'infinite',
									infiniteScroll: true,
								} );
								return;
							}

							setAttributes( { layout: value } );
						} }
					>
						<ToggleGroupControlOptionIcon
							icon={ columns }
							label={ __( 'Carousel', 'godam' ) }
							value="carousel"
						/>
						<ToggleGroupControlOptionIcon
							icon={ grid }
							label={ __( 'Grid', 'godam' ) }
							value="grid"
						/>
						<ToggleGroupControlOptionIcon
							icon={ listView }
							label={ __( 'List', 'godam' ) }
							value="list"
						/>
					</ToggleGroupControl>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'View Ratio', 'godam' ) }
						value={ viewRatio }
						onChange={ ( value ) => value && setAttributes( { viewRatio: value } ) }
					>
						<ToggleGroupControlOption label="4:3" value="4:3" />
						<ToggleGroupControlOption label="9:16" value="9:16" />
						<ToggleGroupControlOption label="3:4" value="3:4" />
						<ToggleGroupControlOption label="1:1" value="1:1" />
						<ToggleGroupControlOption label="16:9" value="16:9" />
					</ToggleGroupControl>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Item Size', 'godam' ) }
						value={ itemWidth }
						onChange={ ( value ) => value && setAttributes( { itemWidth: value } ) }
						help={ __( 'Size of each gallery item.', 'godam' ) }
					>
						<ToggleGroupControlOption label={ __( 'S', 'godam' ) } value="S" />
						<ToggleGroupControlOption label={ __( 'M', 'godam' ) } value="M" />
						<ToggleGroupControlOption label={ __( 'L', 'godam' ) } value="L" />
					</ToggleGroupControl>
					<ToggleControl
						label={ __( 'Show Video Titles and Dates', 'godam' ) }
						checked={ !! showTitle }
						onChange={ ( value ) => setAttributes( { showTitle: value } ) }
					/>
					{
						showEngagementSetting && (
							<ToggleControl
								label={ __( 'Enable Likes & Comments', 'godam' ) }
								checked={ !! engagements }
								onChange={ ( value ) => setAttributes( { engagements: value } ) }
								help={ __( 'Engagement will only be visible for transcoded videos', 'godam' ) }
							/>
						)
					}
					<SelectControl
						label={ __( 'Performance', 'godam' ) }
						value={ performanceMode || 'balanced' }
						options={ performanceModeOptions }
						help={ performanceModeHelpText[ performanceMode || 'balanced' ] }
						onChange={ ( value ) => setAttributes( { performanceMode: value } ) }
					/>
				</PanelBody>

				{ mode === 'query' && (
					<PanelBody title={ __( 'Query Settings', 'godam' ) } initialOpen={ true }>
						<RangeControl
							label={ __( 'Number of videos', 'godam' ) }
							value={ count }
							onChange={ ( value ) => setAttributes( { count: value } ) }
							min={ 1 }
							max={ 30 }
						/>
						<div className="godam-gallery-v2__query-row">
							<div className="godam-gallery-v2__query-col">
								<SelectControl
									label={ __( 'Order by', 'godam' ) }
									value={ orderby }
									options={ [
										{ label: __( 'Date', 'godam' ), value: 'date' },
										{ label: __( 'Title', 'godam' ), value: 'title' },
									] }
									onChange={ ( value ) => setAttributes( { orderby: value } ) }
								/>
							</div>
							<div className="godam-gallery-v2__query-col">
								<SelectControl
									label={ __( 'Order', 'godam' ) }
									value={ order }
									options={ [
										{ label: __( 'Descending', 'godam' ), value: 'desc' },
										{ label: __( 'Ascending', 'godam' ), value: 'asc' },
									] }
									onChange={ ( value ) => setAttributes( { order: value } ) }
								/>
							</div>
						</div>

						<FormTokenField
							className="media-folder-token-field"
							label={ __( 'Media Folder', 'godam' ) }
							value={ selectedMediaFolderToken }
							suggestions={ mediaFolderSuggestions }
							onChange={ updateMediaFolderToken }
							placeholder={ __( 'Search and select media folders', 'godam' ) }
							__experimentalShowHowTo={ false }
						/>

						<FormTokenField
							className="author-token-field"
							label={ __( 'Author', 'godam' ) }
							value={ selectedAuthorToken }
							suggestions={ authorSuggestions }
							onChange={ updateAuthorToken }
							placeholder={ __( 'Search and select authors', 'godam' ) }
							__experimentalShowHowTo={ false }
						/>

						<SelectControl
							label={ __( 'Date Range', 'godam' ) }
							value={ dateRange }
							options={ [
								{ label: __( 'All Time', 'godam' ), value: '' },
								{ label: __( 'Last 7 Days', 'godam' ), value: '7days' },
								{ label: __( 'Last 30 Days', 'godam' ), value: '30days' },
								{ label: __( 'Last 90 Days', 'godam' ), value: '90days' },
								{ label: __( 'Custom Range', 'godam' ), value: 'custom' },
							] }
							onChange={ ( value ) =>
								setAttributes( {
									dateRange: value,
									customDateStart: value === 'custom' ? customDateStart : '',
									customDateEnd: value === 'custom' ? customDateEnd : '',
								} )
							}
						/>
						{ dateRange === 'custom' && (
							<div className="godam-gallery-v2__date-range-picker">
								{ dateError && (
									<Notice status="error" isDismissible={ false }>
										{ dateError }
									</Notice>
								) }
								<div className="godam-gallery-v2__date-field">
									<label htmlFor="godam-gallery-v2-start-date">{ __( 'Start Date', 'godam' ) }</label>
									<button
										id="godam-gallery-v2-start-date"
										type="button"
										className={ `godam-gallery-v2__date-button ${ dateError ? 'has-error' : '' }` }
										onClick={ () => setStartDatePopoverOpen( true ) }
									>
										{ customDateStart ? formatDisplayDate( customDateStart ) : __( 'Select Start Date', 'godam' ) }
									</button>
									{ startDatePopoverOpen && (
										<Popover
											position="bottom left"
											onClose={ () => setStartDatePopoverOpen( false ) }
										>
											<DatePicker
												currentDate={ customDateStart }
												onChange={ ( value ) => {
													handleDateChange( value, 'start' );
													setStartDatePopoverOpen( false );
												} }
												maxDate={ customDateEnd || undefined }
											/>
										</Popover>
									) }
								</div>
								<div className="godam-gallery-v2__date-field">
									<label htmlFor="godam-gallery-v2-end-date">{ __( 'End Date', 'godam' ) }</label>
									<button
										id="godam-gallery-v2-end-date"
										type="button"
										className={ `godam-gallery-v2__date-button ${ dateError ? 'has-error' : '' }` }
										onClick={ () => setEndDatePopoverOpen( true ) }
									>
										{ customDateEnd ? formatDisplayDate( customDateEnd ) : __( 'Select End Date', 'godam' ) }
									</button>
									{ endDatePopoverOpen && (
										<Popover
											position="bottom left"
											onClose={ () => setEndDatePopoverOpen( false ) }
										>
											<DatePicker
												currentDate={ customDateEnd }
												onChange={ ( value ) => {
													handleDateChange( value, 'end' );
													setEndDatePopoverOpen( false );
												} }
												minDate={ customDateStart || undefined }
											/>
										</Popover>
									) }
								</div>
							</div>
						) }
						<ToggleControl
							label={ __( 'Enable More Items', 'godam' ) }
							checked={ !! resolvedEnableMoreItems }
							onChange={ ( value ) => updateMoreItemsSettings( value ) }
						/>
						{ resolvedEnableMoreItems && (
							<SelectControl
								label={ __( 'More Items Behavior', 'godam' ) }
								value={ resolvedMoreItemsBehavior }
								options={ [
									{ label: __( 'Load More Button', 'godam' ), value: 'button' },
									{ label: __( 'Infinite Scroll', 'godam' ), value: 'infinite' },
								] }
								disabled={ isCarouselLayout }
								help={
									isCarouselLayout
										? __( 'Carousel layout always uses Infinite Scroll when more items are enabled.', 'godam' )
										: __( 'Choose how visitors load more videos in query galleries.', 'godam' )
								}
								onChange={ ( value ) => updateMoreItemsSettings( true, value ) }
							/>
						) }
					</PanelBody>
				) }
			</InspectorControls>

			<div { ...blockProps }>

				{ mode === 'handpicked' && (
					<div
						className={ `godam-gallery-v2__canvas godam-gallery-v2__canvas--${ layout }` }
					>
						<InnerBlocks
							allowedBlocks={ ALLOWED_BLOCKS }
							orientation={ layout === 'carousel' ? 'horizontal' : 'vertical' }
							renderAppender={ renderVideoAppender }
						/>
					</div>
				) }

				{ mode === 'query' && (
					<div
						className={ `godam-gallery-v2__canvas godam-gallery-v2__canvas--${ layout }` }
					>
						{ queryPreviewVideos === null && (
							<div className="godam-gallery-v2__state godam-gallery-v2__state--loading">
								<Spinner />
								<span>{ __( 'Loading matching videos…', 'godam' ) }</span>
							</div>
						) }

						{ Array.isArray( queryPreviewVideos ) && queryPreviewVideos.length === 0 && (
							<div className="godam-gallery-v2__state">
								<strong>{ __( 'No videos found', 'godam' ) }</strong>
								<p>{ __( 'Try changing the selected folder, author, or dates.', 'godam' ) }</p>
							</div>
						) }

						{ Array.isArray( previewItems ) && previewItems.length > 0 && (
							<div className="godam-gallery-v2__query-list">
								{ previewItems.map( ( video ) => (
									<div
										className={ `godam-gallery-v2__query-item godam-gallery-v2__query-item--ratio-${ viewRatio.replace( ':', '-' ) }` }
										key={ video.id }
									>
										<div className="godam-gallery-v2__query-thumb">
											{ video.thumbnail ? (
												<img src={ video.thumbnail } alt={ video.title } />
											) : (
												<span>{ __( 'GoDAM Video', 'godam' ) }</span>
											) }
										</div>
										{ showTitle && (
											<div className="godam-gallery-v2__query-meta">
												<strong>{ video.title }</strong>
												<span>{ formatDisplayDate( video.date ) }</span>
											</div>
										) }
									</div>
								) ) }
							</div>
						) }
					</div>
				) }
			</div>
		</>
	);
}
