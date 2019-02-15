import Divider from '@material-ui/core/Divider';
import React, { ReactNode } from 'react';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelActions from '@material-ui/core/ExpansionPanelActions';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { withStyles, createStyles, WithStyles, Theme } from '@material-ui/core/styles';

// import classNames from 'classnames';

export interface SectionProps extends WithStyles<typeof styles> {
  title: ReactNode;
  defaultExpanded?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  onChange?: (event: React.ChangeEvent<{}>, expanded: boolean) => void;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}

const styles = (theme: Theme) => createStyles({
  title: {
    paddingTop: theme.spacing.unit,
    paddingBottom: theme.spacing.unit,
  },
});

const Section = ({ title, classes, className, children, actions, ...props }: SectionProps) => (
  <ExpansionPanel {...props}>
    <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
      {typeof title === 'string'
        ? <Typography variant={'h6'} className={classes.title}>{title}</Typography>
        : title}
    </ExpansionPanelSummary>
    <Divider/>
    <ExpansionPanelDetails className={className}>
      {children}
    </ExpansionPanelDetails>
    {actions && <Divider/>}
    {actions && (
      <ExpansionPanelActions>
        {actions}
      </ExpansionPanelActions>
    )}
  </ExpansionPanel>
);

export default withStyles(styles)(Section);
