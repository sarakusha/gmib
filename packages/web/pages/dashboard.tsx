import React, { PureComponent } from 'react';
import AppBar from '@material-ui/core/AppBar';
import Drawer from '@material-ui/core/Drawer';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import { createStyles, withStyles, WithStyles, Theme } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import ViewIcon from '@material-ui/icons/Visibility';
import RefreshIcon from '@material-ui/icons/Refresh';
import SendIcon from '@material-ui/icons/Send';
import { IStela } from './_app';
import StelaForm from '../components/StelaForm';

const drawerWidth = 240;

const styles = (theme: Theme) => createStyles({
  root: {
    // backgroundColor: theme.palette.background.default,
    // maxWidth: 800,
  },
  frame: {
    backgroundColor: 'black',
    margin: 5,
  },
  paperFrame: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
  },
  appBar: {
    // [theme.breakpoints.up('sm')]: {
    //   width: `calc(100% - ${drawerWidth}px)`,
    //   marginRight: drawerWidth,
    // },
  },
  menuButton: {
    marginRight: 10,
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  },
  toolbar: theme.mixins.toolbar,
  drawerPaper: {
    width: drawerWidth,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
    [theme.breakpoints.down('xs')]: {
      padding: 0,
    },
  },
  row: {
    display: 'flex',
  },
  title: {
    flexGrow: 1,
  },
  right: {
    flexShrink: 0,
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
});

interface Props extends WithStyles<typeof styles>, IStela {}

interface State {
  src: string;
  isOpen: boolean;
  isSubmitting: boolean;
  settingsExpanded: boolean;
}

class Dashboard extends PureComponent<Props, State> {
  static defaultProps = {
    width: 160,
    height: 320,
  };

  submitForm = () => {};
  resetForm = () => {};

  bindSubmitForm = (submitForm: () => void) => {
    this.submitForm = submitForm;
  };

  submittingChanged = (isSubmitting: boolean) => {
    this.setState({ isSubmitting });
  };

  bindResetForm = (resetForm: () => void) => {
    this.resetForm = resetForm;
  };

  reset = () => {
    this.resetForm && this.resetForm();
  };

  state: State = {
    src: null,
    isOpen: false,
    settingsExpanded: true,
    isSubmitting: true,
  };

  componentDidMount() {
    this.setState({ src: `http://${window.location.host}/` });
  }

  handleDrawerToggle = () => {
    this.setState(state => ({ isOpen: !state.isOpen }));
  };

  render() {
    const { classes, update, ...values } = this.props;
    const { width, height, title } = values;
    const { src, isSubmitting } = this.state;
    const scale = (drawerWidth - 10) / width;
    const drawer = (
      <Paper style={{ height: height * scale + 10 }}>
        <iframe
          src={src}
          width={width}
          style={{
            transform: `scale(${scale}`,
            transformOrigin: 'left top',
          }}
          height={height}
          frameBorder={0}
          className={classes.frame}
        >
          Стела
        </iframe>
      </Paper>
    );
    return (
      <div className={classes.root}>
        <AppBar position="fixed" className={classes.appBar}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleDrawerToggle}
              className={classes.menuButton}
              title="Просмотр"
            >
              <ViewIcon />
            </IconButton>
            <Typography
              variant="h6"
              color="inherit"
              className={classes.title}
            >
              {title || 'Стела'}
            </Typography>
            <IconButton
              color="inherit"
              onClick={this.reset}
              className={classes.right}
              title="Сбросить"
              aria-label="Reset form"
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={this.submitForm}
              className={classes.right}
              disabled={isSubmitting}
              title="Отправить"
              aria-label="Send data"
            >
              <SendIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <main className={classes.content}>
          <div className={classes.toolbar} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <StelaForm
              {...values}
              update={update}
              bindSubmitForm={this.bindSubmitForm}
              submittingChanged={this.submittingChanged}
              bindResetForm={this.bindResetForm}
            />
            <aside>
              <Hidden xsDown>
                <div style={{ width: 240 }}>
                  {drawer}
                </div>
              </Hidden>
            </aside>
          </div>
        </main>
        <nav className={classes.drawer}>
          <Hidden smUp>
            <Drawer
              variant="temporary"
              open={this.state.isOpen}
              onClose={this.handleDrawerToggle}
              classes={{
                paper: classes.drawerPaper,
              }}
              anchor="right"
            >
              <div className={classes.toolbar} />
              {drawer}
            </Drawer>
          </Hidden>
        </nav>
      </div>
    );
  }
}

export default withStyles(styles)(Dashboard);
