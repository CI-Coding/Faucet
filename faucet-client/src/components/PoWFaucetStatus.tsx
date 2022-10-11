import { IPoWMinerStats, PoWMiner } from '../common/PoWMiner';
import { PoWSession } from '../common/PoWSession';
import React from 'react';
import { weiToEth } from '../utils/ConvertHelpers';
import { IFaucetConfig } from '../common/IFaucetConfig';
import { renderDate, renderTime, renderTimespan } from '../utils/DateUtils';
import getCountryIcon from 'country-flag-icons/unicode'
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { PoWApi } from 'common/PoWApi';

export interface IPoWFaucetStatusProps {
  powApi: PoWApi;
  faucetConfig: IFaucetConfig;
}

export interface IPoWFaucetStatusState {
  refreshing: boolean;
  activeSessions: IPoWFaucetStatusSession[];
  activeClaims: IPoWFaucetStatusClaim[];
}

export interface IPoWFaucetStatus {
  sessions: IPoWFaucetStatusSession[];
  claims: IPoWFaucetStatusClaim[];
}

export interface IPoWFaucetStatusSession {
  id: string;
  start: number;
  idle: number | null;
  ip: string;
  ipInfo: IPoWFaucetStatusIPInfo;
  target: string;
  balance: number;
  nonce: number;
  hashrate: number;
  status: string;
  claimable: boolean;
  limit: number;
  cliver?: string;
}

export interface IPoWFaucetStatusIPInfo {
  status: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  cityCode?: string;
  locLat?: number;
  locLon?: number;
  zone?: string;
  isp?: string;
  org?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
}

export interface IPoWFaucetStatusClaim {
  time: number;
  session: string;
  target: string;
  amount: number;
  status: string;
  error: string;
  nonce: number | null;
}

export class PoWFaucetStatus extends React.PureComponent<IPoWFaucetStatusProps, IPoWFaucetStatusState> {

  constructor(props: IPoWFaucetStatusProps, state: IPoWFaucetStatusState) {
    super(props);

    this.state = {
      refreshing: false,
      activeSessions: [],
      activeClaims: [],
		};
  }

  public componentDidMount() {
    if(!this.state.refreshing) {
      this.refreshFaucetStatus();
    }
  }

  public componentWillUnmount() {
  }

  private refreshFaucetStatus() {
    this.setState({
      refreshing: true
    });
    this.props.powApi.getFaucetStatus().then((faucetStatus) => {
      let activeClaims = (faucetStatus.claims || []).sort((a, b) => a.time - b.time);
      let activeClaimIds = {};
      activeClaims.forEach((claim) => {
        activeClaimIds[claim.session] = true;
      });

      let activeSessions = (faucetStatus.sessions || []).filter((session) => {
        if(session.status === "closed" && !session.claimable)
          return false;
        if(session.status === "claimed" && !activeClaimIds[session.id])
          return false;
        return true;
      }).sort((a, b) => a.start - b.start);

      this.setState({
        refreshing: false,
        activeSessions: activeSessions,
        activeClaims: activeClaims,
      });
    });
  }

	public render(): React.ReactElement<IPoWFaucetStatusProps> {
    let now = Math.floor((new Date()).getTime() / 1000);

    return (
      <div className='container grid faucet-status'>
        <div className='row'>
          <div className='col-md-auto'>
            <h1>PoW Faucet Status</h1>
          </div>
          <div className='col'>
            <button type="button" className="btn btn-primary status-refresh" onClick={() => this.refreshFaucetStatus()} disabled={this.state.refreshing}>Refresh</button>
          </div>
        </div>
        <div className='row'>
          <div className='col-12 card status-panel'>
            <div className="card-body">
              <h5 className="card-title">Active mining sessions</h5>

              {this.renderActiveSessions()}
            </div>
          </div>
          <div className='col-12 card status-panel'>
            <div className="card-body">
              <h5 className="card-title">Reward claim transactions</h5>

              {this.renderActiveClaims()}
            </div>
          </div>
        </div>
      </div>
    );
	}

  private renderActiveSessions(): React.ReactElement {
    return (
      <table className="table table-striped status-sessions">
        <thead>
          <tr>
            <th scope="col">Session Hash</th>
            <th scope="col">IP Hash</th>
            <th scope="col">Target Address</th>
            <th scope="col">Start Time</th>
            <th scope="col">Timeout</th>
            <th scope="col">Balance</th>
            <th scope="col">Nonce</th>
            <th scope="col">CliVer</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {this.state.activeSessions.length > 0 ?
            this.state.activeSessions.map((session) => this.renderActiveSessionRow(session)) :
            <tr key="none">
              <th scope="row" colSpan={9}>No active sessions</th>
            </tr>
          }
        </tbody>
      </table>
    );
  }

  private renderActiveSessionRow(session: IPoWFaucetStatusSession): React.ReactElement {
    let sessionStatus: React.ReactElement[] = [];
    switch(session.status) {
      case "idle":
        sessionStatus.push(<span key="status" className="badge bg-secondary">Idle ({renderTime(new Date(session.idle * 1000))})</span>);
        break;
      case "mining":
        sessionStatus.push(<span key="status" className="badge bg-success">Mining ({Math.round(session.hashrate * 100) / 100} H/s)</span>);
        break;
      case "closed":
        if(session.claimable)
          sessionStatus.push(<span key="status" className="badge bg-warning text-dark">Claimable ({renderTime(new Date((session.start + this.props.faucetConfig.claimTimeout) * 1000))})</span>);
        else
          sessionStatus.push(<span key="status" className="badge bg-info text-dark">Closed</span>);
        break;
      case "claimed":
        sessionStatus.push(<span key="status" className="badge bg-primary">Claimed</span>);
        break;
      case "slashed":
        sessionStatus.push(<span key="status" className="badge bg-danger">Slashed</span>);
        break;
      default:
        sessionStatus.push(<span key="status" className="badge bg-light text-dark">{session.status}</span>);
    }
    if(session.limit < 100)
      sessionStatus.push(<span key="limit" className="badge bg-warning">{session.limit} %</span>);

    return (
      <tr key={session.id}>
        <th scope="row">{session.id}</th>
        <td>
          <OverlayTrigger
            placement="right"
            delay={{ show: 250, hide: 400 }}
            overlay={(props) => this.renderSessionIpInfo(session, props)}
          >
            <span className='ipaddr'>
              {session.ipInfo.countryCode ? <span className='ipaddr-icon'>{getCountryIcon(session.ipInfo.countryCode)}</span> : null}
              {session.ip}
            </span>
          </OverlayTrigger>
        </td>
        <td>{session.target}</td>
        <td>{renderDate(new Date(session.start * 1000), true)}</td>
        <td>{renderDate(new Date((session.start + this.props.faucetConfig.powTimeout) * 1000), true)}</td>
        <td>{Math.round(weiToEth(session.balance) * 1000) / 1000} {this.props.faucetConfig.faucetCoinSymbol}</td>
        <td>{session.nonce}</td>
        <td>{session.cliver}</td>
        <td>{sessionStatus}</td>
      </tr>
    );
  }

  private renderSessionIpInfo(session: IPoWFaucetStatusSession, props: any): React.ReactElement {
    if(!session.ipInfo)
      return null;
    
    return (
      <Tooltip id="ipinfo-tooltip" {...props}>
        <div className='ipaddr-info'>
          <table>
            {session.ipInfo.status !== "success" ?
              <tr>
                <td colSpan={2} className='ipinfo-value'>{session.ipInfo.status}</td>
              </tr>
            : null}
            <tr>
              <td className='ipinfo-title'>Country:</td>
              <td className='ipinfo-value'>{session.ipInfo.country} ({session.ipInfo.countryCode})</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>Region:</td>
              <td className='ipinfo-value'>{session.ipInfo.region} ({session.ipInfo.regionCode})</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>City:</td>
              <td className='ipinfo-value'>{session.ipInfo.city} ({session.ipInfo.cityCode})</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>ISP:</td>
              <td className='ipinfo-value'>{session.ipInfo.isp}</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>Org:</td>
              <td className='ipinfo-value'>{session.ipInfo.org}</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>AS:</td>
              <td className='ipinfo-value'>{session.ipInfo.as}</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>Proxy:</td>
              <td className='ipinfo-value'>{session.ipInfo.proxy ? "yes" : "no"}</td>
            </tr>
            <tr>
              <td className='ipinfo-title'>Hosting:</td>
              <td className='ipinfo-value'>{session.ipInfo.hosting ? "yes" : "no"}</td>
            </tr>
          </table>
        </div>
      </Tooltip>
    );
  }

  private renderActiveClaims(): React.ReactElement {
    return (
      <table className="table table-striped status-sessions">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Session Hash</th>
            <th scope="col">To Address</th>
            <th scope="col">Amount</th>
            <th scope="col">Nonce</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {this.state.activeClaims.length > 0 ?
            this.state.activeClaims.map((claim) => this.renderActiveClaimRow(claim)) :
            <tr key="none">
              <th scope="row" colSpan={6}>No active claims</th>
            </tr>
          }
        </tbody>
      </table>
    );
  }

  private renderActiveClaimRow(claim: IPoWFaucetStatusClaim): React.ReactElement {
    let claimStatus: React.ReactElement = null;
    switch(claim.status) {
      case "queue":
        claimStatus = <span className="badge bg-secondary">Queued</span>;
        break;
      case "pending":
        claimStatus = <span className="badge bg-primary">Pending</span>;
        break;
      case "confirmed":
        claimStatus = <span className="badge bg-success">Confirmed</span>;
        break;
      case "failed":
        claimStatus = <OverlayTrigger
          placement="left"
          delay={{ show: 250, hide: 400 }}
          overlay={(props) => this.renderClaimFailInfo(claim, props)}
        >
          <span className="badge bg-danger">Failed</span>
        </OverlayTrigger>;
        break;
      default:
        claimStatus = <span className="badge bg-light text-dark">{claim.status}</span>;
    }

    return (
      <tr key={(claim.time + "-" + claim.target)}>
        <th scope="row">{renderDate(new Date(claim.time * 1000), true, true)}</th>
        <td>{claim.session}</td>
        <td>{claim.target}</td>
        <td>{Math.round(weiToEth(claim.amount) * 1000) / 1000} {this.props.faucetConfig.faucetCoinSymbol}</td>
        <td>{claim.nonce || ""}</td>
        <td>{claimStatus}</td>
      </tr>
    );
  }

  private renderClaimFailInfo(claim: IPoWFaucetStatusClaim, props: any): React.ReactElement {
    if(!claim.error)
      return null;
    
    return (
      <Tooltip id="ipinfo-tooltip" {...props}>
        <div className='ipaddr-info claim-error'>
          {claim.error}
        </div>
      </Tooltip>
    );
  }

}
