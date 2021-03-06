import React, { useState, useEffect } from 'react';

import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  Theme,
  createStyles,
  makeStyles,
  useTheme,
} from '@material-ui/core';

import {
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage as LastPageIcon,
} from '@material-ui/icons';

import { TransferRow } from "../types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles ({
    root: {
      flexShrink: 0,
      marginLeft: theme.spacing(2.5),
    },
    table: {
      minWidth: 500,
    },
  }),
);

interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onChangePage: (event: React.MouseEvent<HTMLButtonElement>, newPage: number) => void;
}

const TablePaginationActions = (props: TablePaginationActionsProps) => {
  const classes = useStyles();
  const theme = useTheme();
  const { count, page, rowsPerPage, onChangePage } = props;

  const handleFirstPageButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onChangePage(event, 0);
  };

  const handleBackButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onChangePage(event, page - 1);
  };

  const handleNextButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onChangePage(event, page + 1);
  };

  const handleLastPageButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onChangePage(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <div className={classes.root}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        {theme.direction === 'rtl' ? <LastPageIcon /> : <FirstPageIcon />}
      </IconButton>
      <IconButton onClick={handleBackButtonClick} disabled={page === 0} aria-label="previous page">
        {theme.direction === 'rtl' ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === 'rtl' ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        {theme.direction === 'rtl' ? <FirstPageIcon /> : <LastPageIcon />}
      </IconButton>
    </div>
  );
}

export const EthTransactionLogsTable = (props: any) => {
  const { addressBook, filteredTransactions } = props
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setPage(0)
  }, [filteredTransactions]);

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const classes = useStyles();

  if (!addressBook.addresses || addressBook.addresses.length === 0) {
    return <> Please Update your addresses to view your on chain finances </>
  }

  if (!filteredTransactions) return <> Loading transactions soon </>

  //console.log(filteredTransactions)

  return (
    <TableContainer component={Paper}>
      <Table className={classes.table} aria-label="Transaction Details">
        <TableHead>
          <TableRow>
            <TableCell> Date </TableCell>
            <TableCell> Category </TableCell>
            <TableCell> Amount </TableCell>
            <TableCell> Type </TableCell>
            <TableCell> Value </TableCell>
            <TableCell> From </TableCell>
            <TableCell> To </TableCell>
            <TableCell> Hash </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(rowsPerPage > 0
            ? filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
            : filteredTransactions
          ).map((row: TransferRow, i: number) => (
              <TableRow key={i}>
                <TableCell> {row.date} </TableCell>
                <TableCell> {row.category} </TableCell>
                <TableCell> {row.quantity} </TableCell>
                <TableCell> {row.assetType} </TableCell>
                <TableCell> {row.value} </TableCell>
                <TableCell> {addressBook.getName(row.from)} </TableCell>
                <TableCell> {addressBook.getName(row.to)} </TableCell>
                <TableCell> {row.hash} </TableCell>
              </TableRow>
            ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
              colSpan={6}
              count={filteredTransactions.length}
              rowsPerPage={rowsPerPage}
              page={page}
              SelectProps={{
                inputProps: { 'aria-label': 'rows per page' },
                native: true,
              }}
              onChangePage={handleChangePage}
              onChangeRowsPerPage={handleChangeRowsPerPage}
              ActionsComponent={TablePaginationActions}
            />
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  )
}

