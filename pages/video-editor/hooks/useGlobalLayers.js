/**
 * External dependencies
 */
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { setLayers } from '../redux/slice/videoSlice';
import GlobalLayersManager from '../utils/globalLayersUtils';

/**
 * Custom hook to handle global layers application
 *
 * @param {Object}   options                         - Configuration options
 * @param {number}   options.duration                - Video duration in seconds
 * @param {Object}   options.globalSettings          - Global settings data
 * @param {boolean}  options.isGlobalSettingsLoading - Loading state for global settings
 * @param {Object}   options.globalSettingsError     - Error state for global settings
 * @param {boolean}  options.isFetching              - Forms fetching state
 * @param {Array}    options.currentLayers           - Current video layers
 * @param {Function} options.onError                 - Error callback
 * @param {Function} options.onSuccess               - Success callback
 */
export const useGlobalLayers = ( {
	duration,
	globalSettings,
	isGlobalSettingsLoading,
	globalSettingsError,
	isFetching,
	currentLayers,
	onError,
	onSuccess,
} ) => {
	const dispatch = useDispatch();
	const globalLayersAppliedRef = useRef( false );
	const lastVideoIdRef = useRef( null );
	const globalLayersManagerRef = useRef( null );

	/**
	 * Initialize or update the GlobalLayersManager instance
	 */
	const updateGlobalLayersManager = useCallback( () => {
		if ( globalSettings && duration > 0 ) {
			globalLayersManagerRef.current = new GlobalLayersManager( globalSettings, duration );
		}
	}, [ globalSettings, duration ] );

	/**
	 * Reset global layers state when video changes
	 */
	const resetGlobalLayersState = useCallback( ( videoId ) => {
		if ( lastVideoIdRef.current !== videoId ) {
			globalLayersAppliedRef.current = false;
			lastVideoIdRef.current = videoId;
			globalLayersManagerRef.current = null;
		}
	}, [] );

	/**
	 * Check if all conditions are met for applying global layers
	 */
	const canApplyGlobalLayers = useCallback( () => {
		// Basic validation
		if (
			! duration ||
			duration <= 0 ||
			! globalSettings ||
			isGlobalSettingsLoading ||
			globalSettingsError ||
			globalLayersAppliedRef.current
		) {
			return false;
		}

		// Check if forms are needed and still loading
		const hasFormLayer = globalSettings?.global_layers?.forms?.enabled;
		if ( hasFormLayer && isFetching ) {
			return false;
		}

		return true;
	}, [ duration, globalSettings, isGlobalSettingsLoading, globalSettingsError, isFetching ] );

	/**
	 * Apply global layers to the video using the class-based manager
	 */
	const applyGlobalLayers = useCallback( async () => {
		if ( ! canApplyGlobalLayers() ) {
			return;
		}

		try {
			updateGlobalLayersManager();

			if ( ! globalLayersManagerRef.current ) {
				throw new Error( 'GlobalLayersManager not initialized' );
			}

			const updatedLayers = globalLayersManagerRef.current.getMergedLayers( currentLayers );

			dispatch( setLayers( updatedLayers ) );

			const globalLayers = globalLayersManagerRef.current.getGlobalLayers( updatedLayers );

			if ( globalLayers.length > 0 ) {
				onSuccess?.( globalLayers );
			}

			globalLayersAppliedRef.current = true;
		} catch ( error ) {
			globalLayersAppliedRef.current = true;

			onError?.( error );
		}
	}, [
		canApplyGlobalLayers,
		updateGlobalLayersManager,
		currentLayers,
		dispatch,
		onSuccess,
		onError,
	] );

	/**
	 * Get current global layers manager instance
	 */
	const getGlobalLayersManager = useCallback( () => {
		return globalLayersManagerRef.current;
	}, [] );

	/**
	 * Effect to apply global layers when conditions are met
	 */
	useEffect( () => {
		applyGlobalLayers();
	}, [ applyGlobalLayers ] );

	return {
		globalLayersApplied: globalLayersAppliedRef.current,
		resetGlobalLayersState,
		applyGlobalLayers,
		canApplyGlobalLayers: canApplyGlobalLayers(),
		getGlobalLayersManager,
	};
};
