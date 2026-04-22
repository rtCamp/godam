const MissingLayerControls = () => null;
const MissingLayersHeader = () => null;

const missingAction = () => ( {
	type: '@@godam-woo/missing-runtime',
} );

const getRuntimeComponentFallback = ( componentName ) => {
	if ( componentName === 'LayerControls' ) {
		return MissingLayerControls;
	}

	if ( componentName === 'LayersHeader' ) {
		return MissingLayersHeader;
	}

	return () => null;
};

export const getGodamVideoEditorComponent = ( componentName ) => {
	return window.godamVideoEditorComponents?.[ componentName ] || getRuntimeComponentFallback( componentName );
};

export const getGodamVideoEditorAction = ( actionName ) => {
	return window.godamVideoEditorActions?.[ actionName ] || missingAction;
};