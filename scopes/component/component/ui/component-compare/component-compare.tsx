import { ComponentContext, ComponentID } from '@teambit/component';
import classNames from 'classnames';
import flatten from 'lodash.flatten';
import React, { useContext, useState, HTMLAttributes, useCallback, useMemo } from 'react';
import { SplitPane, Pane, Layout } from '@teambit/base-ui.surfaces.split-pane.split-pane';
import { HoverSplitter } from '@teambit/base-ui.surfaces.split-pane.hover-splitter';
import { Collapser } from '@teambit/ui-foundation.ui.buttons.collapser';
import { TreeNode as Node } from '@teambit/ui-foundation.ui.tree.tree-node';
import type { FileIconSlot } from '@teambit/code';
import { CodeCompareView } from '@teambit/code.ui.code-compare-view';
import { useCode } from '@teambit/code.ui.queries.get-component-code';
import { useIsMobile } from '@teambit/ui-foundation.ui.hooks.use-is-mobile';
import { TreeContext } from '@teambit/base-ui.graph.tree.tree-context';
import { LanesModel, useLanesContext } from '@teambit/lanes.ui.lanes';
import { getFileIcon, FileIconMatch } from '@teambit/code.ui.utils.get-file-icon';
import { FolderTreeNode } from '@teambit/ui-foundation.ui.tree.folder-tree-node';
import { FileTree } from '@teambit/ui-foundation.ui.tree.file-tree';
import { DrawerUI } from '@teambit/ui-foundation.ui.tree.drawer';
import { Contributors } from '@teambit/design.ui.contributors';
import { H2 } from '@teambit/documenter.ui.heading';
import { LegacyComponentLog } from '@teambit/legacy-component-log';
import { useComponentCompareParams } from './use-component-compare-params';

import styles from './component-compare.module.scss';

export type ComponentCompareProps = {
  fileIconSlot?: FileIconSlot;
} & HTMLAttributes<HTMLDivElement>;

/*
  Component Aspect registers the Component Compare Page 
   * version: it is the currently viewed version. Component Context keeps track of this and sets the version 
   *          of the component in the context accordingly.
   * to: version to compare to, if present auto select it in the dropdown
   * selected: selected defaults to the first composition of the component, the user 
   *           can change selection between the following drawers; 
   *           compositions, files, aspects, dependencies. (~file/, ~composition/, ~aspects/, ~dependencies/)
   * * clicking on the compare button computes the compare between the selected versions
   * note: highlight the compare button when the selection changes
 */
export function ComponentCompare({ fileIconSlot, className }: ComponentCompareProps) {
  const { toVersion, selected: currentFile } = useComponentCompareParams();
  const component = useContext(ComponentContext);

  const [showCodeCompare] = useState<boolean>(true);

  const fromComponentId = component.id;

  const [currentVersionInfo, lastVersionInfo] = useMemo(() => {
    const [currentLog, lastLog] = component?.logs?.reverse() || [];
    return [currentLog, lastLog];
  }, component.logs);

  const toComponentId =
    (toVersion && component.id.changeVersion(toVersion)) ||
    (lastVersionInfo && component.id.changeVersion(lastVersionInfo.hash)) ||
    fromComponentId;

  const isMobile = useIsMobile();
  const [isSidebarOpen, setSidebarOpenness] = useState(!isMobile);
  const sidebarOpenness = isSidebarOpen ? Layout.row : Layout.left;

  return (
    <SplitPane layout={sidebarOpenness} size="85%" className={classNames(styles.componentCompareContainer, className)}>
      <Pane className={styles.left}>
        <H2>{component.id.fullName}</H2>
        <div className={styles.componentCompareVersionSelector}>
          <ComponentCompareVersionInfo versionInfo={currentVersionInfo} />
          <ComponentCompareVersionInfo versionInfo={lastVersionInfo} />
        </div>
        <div className={styles.componentCompareViewerContainer}></div>
        {showCodeCompare && <CodeCompareView to={toComponentId} fileName={currentFile} from={fromComponentId} />}
      </Pane>
      <HoverSplitter className={styles.splitter}>
        <Collapser
          placement="left"
          isOpen={isSidebarOpen}
          onMouseDown={(e) => e.stopPropagation()} // avoid split-pane drag
          onClick={() => setSidebarOpenness((x) => !x)}
          tooltipContent={`${isSidebarOpen ? 'Hide' : 'Show'} file tree`}
          className={styles.collapser}
        />
      </HoverSplitter>
      <Pane className={classNames(styles.componentCompareTreeContainer, styles.right)}>
        <ComponentCompareTree
          currentFile={currentFile}
          toComponentId={toComponentId}
          fromComponentId={fromComponentId}
          fileIconSlot={fileIconSlot}
        />
      </Pane>
    </SplitPane>
  );
}

export type ComponentCompareVersionInfoProps = {
  versionInfo: LegacyComponentLog;
} & HTMLAttributes<HTMLDivElement>;

export function ComponentCompareVersionInfo({ className, versionInfo }: ComponentCompareVersionInfoProps) {
  const { date, message, username, email, tag, hash } = versionInfo;
  const timestamp = useMemo(() => (date ? new Date(parseInt(date)).toString() : new Date().toString()), [date]);
  const commitMessage =
    !message || message === '' ? (
      <div className={styles.emptyMessage}>No commit message</div>
    ) : (
      <div className="commitMessage">{message}</div>
    );
  const author = {
    displayName: username,
    email,
  };
  const version = tag ? `v${tag}` : hash;

  return (
    <div className={classNames(styles.currentVersionContainer, className)}>
      <div className="currentVersion">{version}</div>
      <Contributors contributors={[author || {}]} timestamp={timestamp} />
      {commitMessage}
    </div>
  );
}

export type ComponentCompareTreeProps = {
  currentFile?: string;
  fileIconSlot?: FileIconSlot;
  fromComponentId: ComponentID;
  toComponentId: ComponentID;
} & HTMLAttributes<HTMLDivElement>;

export function ComponentCompareTree({
  currentFile,
  fromComponentId,
  toComponentId,
  fileIconSlot,
  className,
}: ComponentCompareTreeProps) {
  const fileIconMatchers: FileIconMatch[] = useMemo(() => flatten(fileIconSlot?.values()), [fileIconSlot]);
  const icon = getFileIcon(fileIconMatchers, currentFile);
  const { mainFile: fromMainFile, fileTree: fromFileTree = [], devFiles: fromDevFiles = [] } = useCode(fromComponentId);
  const { fileTree: toFileTree = [], devFiles: toDevFiles = [] } = useCode(toComponentId);
  const fileTree = fromFileTree.concat(toFileTree);
  const devFiles = fromDevFiles?.concat(toDevFiles);

  const treeNodeRenderer = useCallback(
    function TreeNode(props: any) {
      const children = props.node.children;
      const { selected } = useContext(TreeContext);
      const lanesContext = useLanesContext();
      const { componentId } = useComponentCompareParams();

      const currentLaneUrl = lanesContext?.viewedLane
        ? `${LanesModel.getLaneUrl(lanesContext?.viewedLane.id)}${LanesModel.baseLaneComponentRoute}`
        : '';
      const toVersionUrl = `${(toComponentId?.version && '&to='.concat(toComponentId.version)) || ''}`;
      const fromVersionUrl = `from=${fromComponentId.version}`;
      const href = `${currentLaneUrl}/${componentId}/~compare/${props.node.id}/?${fromVersionUrl}${toVersionUrl}`;

      if (!children) {
        return <Node href={href} {...props} isActive={props.node.id === selected} icon={icon} />;
      }
      return <FolderTreeNode {...props} />;
    },
    [fileIconMatchers, devFiles]
  );

  const [openDrawerList, onToggleDrawer] = useState(['FILES']);

  const handleDrawerToggle = (id: string) => {
    const isDrawerOpen = openDrawerList.includes(id);
    if (isDrawerOpen) {
      onToggleDrawer((list) => list.filter((drawer) => drawer !== id));
      return;
    }
    onToggleDrawer((list) => list.concat(id));
  };

  return (
    <div className={classNames(styles.codeTabTree, className)}>
      <DrawerUI
        isOpen={openDrawerList.includes('FILES')}
        onToggle={() => handleDrawerToggle('FILES')}
        name="FILES"
        contentClass={styles.codeDrawerContent}
        className={classNames(styles.codeTabDrawer)}
      >
        <FileTree TreeNode={treeNodeRenderer} files={fileTree || ['']} selected={currentFile} />
      </DrawerUI>
      <DrawerUI
        isOpen={openDrawerList.includes('DEPENDENCIES')}
        onToggle={() => handleDrawerToggle('DEPENDENCIES')}
        className={classNames(styles.codeTabDrawer)}
        contentClass={styles.codeDrawerContent}
        name="DEPENDENCIES"
      >
        {/* <DependencyTree dependenciesArray={dependencies} /> */}
      </DrawerUI>
    </div>
  );
}
// return (
//   <div style={{ ...indentStyle(1), ...rest.style }} {...rest}>
//     <TreeNodeContext.Provider value={TreeNode}>
//       <TreeContextProvider onSelect={onSelect} selected={selected}>
//         <RootNode node={rootNode} depth={1} />
//       </TreeContextProvider>
//     </TreeNodeContext.Provider>
//   </div>
// );
