import java.util.Scanner;
public class feladatharom {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Add meg a felhasználónevedet: ");
        String felhasznalonev = sc. next();
        System.out.print("Add meg az életkorodat: ");
        int eletkor = sc. nextInt();
        System.out.print("Neved: " + felhasznalonev);
        System.out.print("\nKorod: " + eletkor);
    }
}