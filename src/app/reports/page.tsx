'use client';

import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import {
  Stack,
  Title,
  Text,
  Card,
  Table,
  TextInput,
  Badge,
  Pagination,
  Group,
  Loader,
  Center,
} from '@mantine/core';
import { AppShell } from '../../components/layout/AppShell';
import { GetTransactionsResponse, TransactionData } from '../../types/graphql';

const GET_TRANSACTIONS = gql`
  query GetTransactions($page: Int, $pageSize: Int, $search: String) {
    getTransactions(page: $page, pageSize: $pageSize, search: $search) {
      transactions {
        transactionId
        timestamp
        type
        quantity
        notes
        patientReferenceId
      }
      total
      page
      pageSize
    }
  }
`;

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, loading } = useQuery<GetTransactionsResponse>(GET_TRANSACTIONS, {
    variables: { page, pageSize: 20, search: search || undefined },
  });

  const totalPages = data
    ? Math.ceil(data.getTransactions.total / data.getTransactions.pageSize)
    : 0;

  return (
    <AppShell>
      <Stack gap="xl">
        <div>
          <Title order={1}>Reports</Title>
          <Text c="dimmed" size="sm">
            Transaction logs and audit trail
          </Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <TextInput
            placeholder="Search by notes or patient reference..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            mb="md"
          />

          {loading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : data?.getTransactions.transactions && data.getTransactions.transactions.length > 0 ? (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date & Time</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Patient Ref</Table.Th>
                    <Table.Th>Notes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data?.getTransactions.transactions.map((tx: TransactionData) => (
                    <Table.Tr key={tx.transactionId}>
                      <Table.Td>{new Date(tx.timestamp).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            tx.type === 'check in'
                              ? 'green'
                              : tx.type === 'check out'
                              ? 'blue'
                              : 'orange'
                          }
                        >
                          {tx.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{tx.quantity}</Table.Td>
                      <Table.Td>{tx.patientReferenceId || '-'}</Table.Td>
                      <Table.Td>{tx.notes || '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={setPage} />
              </Group>
            </>
          ) : (
            <Text c="dimmed">No transactions found</Text>
          )}
        </Card>
      </Stack>
    </AppShell>
  );
}
